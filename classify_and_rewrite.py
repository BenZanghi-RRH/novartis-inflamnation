import ijson
import ijson
import json
import sys
import re # For more flexible keyword matching
import traceback
from collections.abc import Mapping, MutableSequence # For type checking
from decimal import Decimal # Import Decimal

# --- Configuration ---
INPUT_FILE = 'public/data.json'
OUTPUT_FILE = 'public/data-2.json'

TARGET_CATEGORIES = [
    'Ankylosing Spondylitis',
    'Hidradenitis Suppurativa',
    'Plaque Psoriasis',
    'Psoriatic Arthritis',
    'Breast Cancer',
    'Heart Disease',
    "Sjögren's Syndrome",
    'Other' # Default/fallback category
]

# --- Keyword Definitions (Case-Insensitive) ---
# Order matters for overlapping conditions (e.g., Psoriasis types)
# More specific terms should ideally come first within a category check.
KEYWORDS = {
    'Ankylosing Spondylitis': [r'ankylosing', r'spondylitis', r'bamboo spine'], # Removed r'\bas\b'
    'Hidradenitis Suppurativa': [r'hidradenitis', r'suppurativa', r'\bhs\b', r'acne inversa'],
    'Psoriatic Arthritis': [r'psoriatic arthritis', r'\bpsa\b'], # Check before Plaque Psoriasis if text is used
    'Plaque Psoriasis': [r'plaque psoriasis', r'psoriasis vulgaris'],
    'Breast Cancer': [r'breast cancer', r'mastectomy', r'lumpectomy', r'\bbrca\b', r'\bbc\b', r'triple negative'], # Added keywords
    'Heart Disease': [
        r'heart disease', r'cardiac', r'cardiovascular', r'heart attack', r'heart failure', # Added keyword
        r'myocardial infarction', r'angina', r'atrial fibrillation', r'afib', r'bypass', r'stent', # Added keywords
        r'congestive heart failure', r'chf', r'arrhythmia', r'coronary artery'
    ],
    "Sjögren's Syndrome": [r"sjögren's", r"sjogren's", r'sicca syndrome'],
    # General Psoriasis (used for refinement if specific type isn't mentioned)
    '_General Psoriasis': [r'psoriasis']
}

# Pre-compile regex patterns for efficiency
REGEX_PATTERNS = {
    category: [re.compile(p, re.IGNORECASE) for p in patterns]
    for category, patterns in KEYWORDS.items()
}

def classify_testimonial(disease_field, text):
    """
    Classifies a testimonial based on disease field and text content.
    Uses a combined keyword approach.
    """
    disease_str = str(disease_field).strip() if disease_field is not None else ""
    text_str = str(text).strip() if text is not None else ""
    disease_lower = disease_str.lower() # Pre-calculate lower case for comparisons

    # --- Stage 1: Check Disease Field First ---
    if disease_str:
        # Check specific categories first
        for category in TARGET_CATEGORIES:
            if category == 'Other': continue # Skip 'Other' for now
            patterns = REGEX_PATTERNS.get(category, [])
            for pattern in patterns:
                if pattern.search(disease_str):
                    # Special handling for Psoriasis: If disease field is just "Psoriasis",
                    # defer to text analysis for specific type.
                    if category in ['Plaque Psoriasis', 'Psoriatic Arthritis'] and \
                       disease_lower == 'psoriasis':
                           # Found generic psoriasis, break inner loop and go to text analysis
                           break
                    # Found specific match in disease field
                    return category
            else:
                # Continue check if inner loop wasn't broken by generic psoriasis find
                continue
            # If inner loop was broken by generic psoriasis find, break outer loop too
            break


        # Check general psoriasis if specific types weren't matched directly
        # This check is implicitly handled by the fall-through if disease_lower == 'psoriasis'
        # If disease field had content but didn't match anything specific,
        # still fall through to text analysis as it might contain clues.

    # --- Stage 2: Check Text Content (if needed or for refinement) ---
    classification_from_text = None
    if text_str:
        # Prioritize Psoriatic Arthritis keywords in text
        if any(p.search(text_str) for p in REGEX_PATTERNS.get('Psoriatic Arthritis', [])):
            # Check for joint/arthritis mentions to increase confidence if disease was just 'Psoriasis'
            if disease_lower == 'psoriasis':
                 if re.search(r'joint|arthritis', text_str, re.IGNORECASE):
                     classification_from_text = 'Psoriatic Arthritis'
            else: # If disease field wasn't psoriasis, finding PsA keywords is strong signal
                 classification_from_text = 'Psoriatic Arthritis'

        # Check Plaque Psoriasis keywords in text (only if PsA not found)
        if classification_from_text is None and \
           any(p.search(text_str) for p in REGEX_PATTERNS.get('Plaque Psoriasis', [])):
             # Check for skin/plaque mentions to increase confidence if disease was just 'Psoriasis'
             if disease_lower == 'psoriasis':
                 if re.search(r'skin|plaque|scale|lesion', text_str, re.IGNORECASE):
                     classification_from_text = 'Plaque Psoriasis'
             else: # If disease field wasn't psoriasis, finding Plaque keywords is strong signal
                 classification_from_text = 'Plaque Psoriasis'

        # Check other categories in text (if not already found in disease field or text)
        if classification_from_text is None:
            for category in TARGET_CATEGORIES:
                 # Skip categories already checked or 'Other'
                 if category in ['Other', 'Plaque Psoriasis', 'Psoriatic Arthritis']: continue
                 patterns = REGEX_PATTERNS.get(category, [])
                 if any(p.search(text_str) for p in patterns):
                     # Special check for Sjogren's - look for dry eyes/mouth
                     if category == "Sjögren's Syndrome":
                         if re.search(r'dry eye|dry mouth', text_str, re.IGNORECASE):
                             classification_from_text = category
                             break # Found match
                     else:
                        classification_from_text = category # Found match in text
                        break # Found match

    # If text analysis provided a classification, return it
    if classification_from_text:
        return classification_from_text

    # --- Stage 3: Fallback ---
    # If disease field was just 'Psoriasis' and text didn't specify type, classify as 'Other'.
    if disease_lower == 'psoriasis':
        return 'Other'

    # If disease field had a specific match in Stage 1, it was returned.
    # If text analysis yielded a match, it was returned.
    # If we reach here, no specific category was identified.
    return 'Other'


def process_json_stream(input_filepath, output_filepath):
    """
    Reads the input JSON stream, classifies testimonials, and writes to output JSON stream.
    """
    print(f"Starting processing: {input_filepath} -> {output_filepath}")
    processed_counties = 0
    processed_testimonials = 0
    error_count = 0

    try:
        with open(input_filepath, 'rb') as f_in, \
             open(output_filepath, 'w', encoding='utf-8') as f_out:

            f_out.write('{\n') # Start the JSON object

            # Use ijson.parse for lower-level control to handle potential non-dict items
            events = ijson.parse(f_in)
            current_key = None
            current_county_data = None
            first_county = True

            # We need to reconstruct the county object as we parse its events
            # This is more complex but necessary if ijson.kvitems fails on malformed data
            # Let's try kvitems first, assuming data is mostly well-formed object of objects
            parser = ijson.kvitems(f_in, '')

            for fips_code, county_data in parser:
                processed_counties += 1
                if not isinstance(county_data, Mapping): # Check if it's dictionary-like
                    print(f"Warning: Skipping non-dictionary value for key '{fips_code}' (Type: {type(county_data)})", file=sys.stderr)
                    error_count += 1
                    continue

                # --- Create a modifiable copy ---
                # Deep copy might be needed if structures are complex/nested beyond testimonials
                # Let's try shallow copy first for performance. If issues arise, switch to deepcopy.
                # import copy; modified_county_data = copy.deepcopy(county_data)
                modified_county_data = dict(county_data) # Create a new dict

                # --- Process positive_verbatim ---
                pos_verbatims_orig = modified_county_data.get('positive_verbatim')
                if isinstance(pos_verbatims_orig, MutableSequence): # Check if list-like
                    # Create a new list to store modified testimonials
                    modified_pos_verbatims = []
                    for testimonial in pos_verbatims_orig:
                        if isinstance(testimonial, Mapping): # Check if dict-like
                            # Copy testimonial to avoid modifying original if shallow copy was used above
                            mod_testimonial = dict(testimonial)
                            disease = mod_testimonial.get('disease')
                            text = mod_testimonial.get('nn_verbatim')
                            classification = classify_testimonial(disease, text)
                            mod_testimonial['classification'] = classification
                            modified_pos_verbatims.append(mod_testimonial)
                            processed_testimonials += 1
                        else:
                             print(f"Warning: Non-dict item in positive_verbatim for {fips_code}: {str(testimonial)[:100]}", file=sys.stderr)
                             modified_pos_verbatims.append(testimonial) # Keep original if not dict
                             error_count += 1
                    # Replace original list with the modified one
                    modified_county_data['positive_verbatim'] = modified_pos_verbatims
                elif pos_verbatims_orig is not None:
                     print(f"Warning: 'positive_verbatim' for {fips_code} is not a list (Type: {type(pos_verbatims_orig)})", file=sys.stderr)
                     error_count += 1


                # --- Process negative_verbatim ---
                neg_verbatims_orig = modified_county_data.get('negative_verbatim')
                if isinstance(neg_verbatims_orig, MutableSequence): # Check if list-like
                    modified_neg_verbatims = []
                    for testimonial in neg_verbatims_orig:
                        if isinstance(testimonial, Mapping): # Check if dict-like
                            mod_testimonial = dict(testimonial)
                            disease = mod_testimonial.get('disease')
                            text = mod_testimonial.get('nn_verbatim')
                            classification = classify_testimonial(disease, text)
                            mod_testimonial['classification'] = classification
                            modified_neg_verbatims.append(mod_testimonial)
                            processed_testimonials += 1
                        else:
                             print(f"Warning: Non-dict item in negative_verbatim for {fips_code}: {str(testimonial)[:100]}", file=sys.stderr)
                             modified_neg_verbatims.append(testimonial) # Keep original
                             error_count += 1
                    modified_county_data['negative_verbatim'] = modified_neg_verbatims
                elif neg_verbatims_orig is not None:
                     print(f"Warning: 'negative_verbatim' for {fips_code} is not a list (Type: {type(neg_verbatims_orig)})", file=sys.stderr)
                     error_count += 1

                # --- Write the modified county data to the output file ---
                try:
                    if not first_county:
                        f_out.write(',\n') # Add comma before the next county entry

                    # Dump the FIPS code (key) and the modified county data (value)
                    # Use compact separators for efficiency
                    fips_json = json.dumps(fips_code)
                    # Ensure county data is serializable, handling Decimals
                    county_json = json.dumps(modified_county_data, separators=(',', ':'), default=decimal_default)
                    f_out.write(f'  {fips_json}: {county_json}')

                    first_county = False
                except TypeError as json_err:
                    print(f"Error: Could not serialize county data for FIPS {fips_code}. Skipping.", file=sys.stderr)
                    print(f"Serialization Error: {json_err}", file=sys.stderr)
                    # Attempt to dump problematic data for debugging
                    # try:
                    #     print("Problematic Data Snippet:", repr(modified_county_data)[:500], file=sys.stderr)
                    # except: pass
                    error_count += 1
                    # We need to handle the comma logic if we skip an item - this is tricky.
                    # For simplicity, the output JSON might be slightly invalid if items are skipped.
                    # A better approach would buffer output or use a proper JSON streaming library.


                if processed_counties % 500 == 0:
                    print(f"  Processed {processed_counties} counties...")

            f_out.write('\n}') # End the JSON object
            print(f"\nProcessing complete.")
            print(f"Total counties processed: {processed_counties}")
            print(f"Total testimonials processed and classified: {processed_testimonials}")
            if error_count > 0:
                print(f"Warnings/Errors encountered: {error_count}")
            print(f"Output written to: {output_filepath}")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_filepath}", file=sys.stderr)
        sys.exit(1)
    except ijson.JSONError as e:
        print(f"Error parsing input JSON: {e}", file=sys.stderr)
        print(f"Processing stopped at county {processed_counties+1}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

# Custom JSON encoder helper for Decimal
def decimal_default(obj):
    if isinstance(obj, Decimal):
        # Convert Decimal to string to preserve precision, or float if preferred
        return str(obj)
        # return float(obj) # Alternative: convert to float
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


if __name__ == "__main__":
    process_json_stream(INPUT_FILE, OUTPUT_FILE)

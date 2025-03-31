import ijson # Using ijson for memory-efficient parsing of large JSON files
import ijson
import sys
from collections import defaultdict
import traceback # Keep traceback for error reporting

# No longer need normalization logic here, as we read pre-classified data

def analyze_classified_data(filepath):
    """Analyzes the data-2.json file which includes the 'classification' field."""
    total_testimonials = 0
    classification_counts = defaultdict(int) # Count occurrences of each classification

    try:
        with open(filepath, 'rb') as f:
            parser = ijson.kvitems(f, '') # Still use kvitems for the root object

            for fips_code, county_data in parser:
                if not isinstance(county_data, dict):
                    print(f"Warning: Skipping non-dictionary value for key '{fips_code}'", file=sys.stderr)
                    continue

                # Process positive testimonials
                positive_verbatims = county_data.get('positive_verbatim', [])
                if isinstance(positive_verbatims, list):
                    for testimonial in positive_verbatims:
                         # Check if testimonial is a dict and has the 'classification' key
                         if isinstance(testimonial, dict) and 'classification' in testimonial:
                            total_testimonials += 1
                            classification = testimonial.get('classification', 'Other') # Default to 'Other' if key exists but value is None/empty
                            classification_counts[classification] += 1
                         elif isinstance(testimonial, dict):
                             # Log if dict but missing 'classification' key
                             print(f"Warning: Missing 'classification' key in positive_verbatim for {fips_code}: {str(testimonial)[:100]}...", file=sys.stderr)
                             classification_counts['Other'] += 1 # Count as 'Other' if key missing
                             total_testimonials += 1 # Still count it as a testimonial processed
                         else:
                             # Log if the item is not a dict
                             print(f"Warning: Skipping non-dict item in positive_verbatim for {fips_code}: Type={type(testimonial)}, Content={str(testimonial)[:100]}...", file=sys.stderr)

                # Process negative testimonials
                negative_verbatims = county_data.get('negative_verbatim', [])
                if isinstance(negative_verbatims, list):
                    for testimonial in negative_verbatims:
                         # Check if testimonial is a dict and has the 'classification' key
                         if isinstance(testimonial, dict) and 'classification' in testimonial:
                            total_testimonials += 1
                            classification = testimonial.get('classification', 'Other')
                            classification_counts[classification] += 1
                         elif isinstance(testimonial, dict):
                             print(f"Warning: Missing 'classification' key in negative_verbatim for {fips_code}: {str(testimonial)[:100]}...", file=sys.stderr)
                             classification_counts['Other'] += 1
                             total_testimonials += 1
                         else:
                             print(f"Warning: Skipping non-dict item in negative_verbatim for {fips_code}: Type={type(testimonial)}, Content={str(testimonial)[:100]}...", file=sys.stderr)

        print(f"Total patient testimonials analyzed: {total_testimonials}")

        print(f"\nNumber of unique classification categories found: {len(classification_counts)}")
        print("Classification counts:")
        # Sort by count descending, then alphabetically
        sorted_classifications = sorted(classification_counts.items(), key=lambda item: (-item[1], item[0]))
        for classification, count in sorted_classifications:
            print(f"- {classification}: {count}")

        # No longer tracking raw disease names here
        # print(f"\nNumber of unique *raw* disease names encountered: {len(raw_disease_names)}")
        # # Optionally print raw names if needed for debugging mapping issues
        # # print("Raw disease names found (sample):")
        # # for i, name in enumerate(sorted(list(raw_disease_names))):
        #     # ... (code removed)


    except FileNotFoundError:
        print(f"Error: File not found at {filepath}", file=sys.stderr)
    except ijson.JSONError as e:
        print(f"Error parsing JSON from '{filepath}': {e}", file=sys.stderr)
    except Exception as e:
        print(f"An error occurred during analysis of '{filepath}': {e}", file=sys.stderr)
        traceback.print_exc()


if __name__ == "__main__":
    file_to_analyze = 'public/data-2.json' # Point to the newly classified file
    analyze_classified_data(file_to_analyze) # Call the renamed function

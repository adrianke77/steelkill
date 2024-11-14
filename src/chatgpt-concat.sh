#!/bin/bash

# Initialize variables
max_lines=3000          # Maximum lines per output file
file_index=1            # Output file index
current_lines=0         # Current line count
output_file="../combined_${file_index}.txt"  # Initial output file

# Remove existing combined files to avoid appending to old data
rm -f ../combined_*.txt

# Function to start a new output file and write the header line
start_new_output_file() {
  output_file="../combined_${file_index}.txt"
  echo "Remember this code for this convo, no comments are needed." > "$output_file"
  echo >> "$output_file" 
  current_lines=0
}

# Start the first output file
start_new_output_file

# Find all .ts and .tsx files excluding specified directories
find . \
  \( -name dist -o -name node_modules -o -name public \) -prune -o \
  \( -name "*.ts" -o -name "*.tsx" \) -type f | while read -r file; do

  # Get the number of lines in the current file
  file_lines=$(wc -l < "$file")

  # Check if adding this file would exceed the max_lines
  if (( current_lines + file_lines > max_lines )); then
    # Start a new output file
    file_index=$((file_index + 1))
    start_new_output_file
  fi

  # Append the file content to the current output file
  cat "$file" >> "$output_file"

  # Update the current line count
  current_lines=$((current_lines + file_lines))

done

echo "Files have been concatenated into combined_*.txt with a maximum of ${max_lines} lines each."

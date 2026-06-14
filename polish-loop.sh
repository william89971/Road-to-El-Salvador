#!/bin/bash
# polish-loop.sh

# Configuration
TASKS_FILE="TASKLIST.md"
LOG_FILE="polish-log.txt"
MAX_RUNS=10
RUN_COUNT=0

# Ensure we start fresh (create or reset the branch)
git checkout -B automated-polishing main

while [ $RUN_COUNT -lt $MAX_RUNS ]; do
  echo "=== Loop run $((RUN_COUNT+1)) at $(date) ===" | tee -a $LOG_FILE
  
  # Run CodeWhale in YOLO mode with a specific prompt
  codewhale --yolo "Read $TASKS_FILE. Find the first incomplete task (marked '- [ ]'). 
  Complete that single task. Update the task status in $TASKS_FILE to '- [x]' when done. 
  Run 'npm run build' to verify no errors. If build passes, create a git commit with 
  the task description as the message. Then exit." >> $LOG_FILE 2>&1
  
  if [ $? -ne 0 ]; then
    echo "CodeWhale failed on run $((RUN_COUNT+1)). Check $LOG_FILE." | tee -a $LOG_FILE
    break
  fi
  
  RUN_COUNT=$((RUN_COUNT+1))
  sleep 2 # Brief pause between loops
done

echo "Loop finished after $RUN_COUNT runs."

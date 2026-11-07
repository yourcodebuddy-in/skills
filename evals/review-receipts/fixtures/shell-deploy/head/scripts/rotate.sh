#!/bin/bash
# Keeps the newest five releases under $RELEASES_DIR.
cd $RELEASES_DIR
for old in $(ls -1t | tail -n +6); do
  rm -rf $old
done

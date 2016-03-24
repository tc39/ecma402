#!/bin/bash

declare -r PRIVATE_KEY_FILE_NAME='github_deploy_key'

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

# Decrypt the file containing the private key

openssl aes-256-cbc \
    -K  $encrypted_aef280a8b6af_key \
    -iv $encrypted_aef280a8b6af_iv \
    -in "$(dirname "$BASH_SOURCE")/${PRIVATE_KEY_FILE_NAME}.enc" \
    -out ~/.ssh/$PRIVATE_KEY_FILE_NAME -d

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

# Enable SSH authentication

chmod 600 ~/.ssh/$PRIVATE_KEY_FILE_NAME
echo "Host github.com" >> ~/.ssh/config
echo "  IdentityFile ~/.ssh/$PRIVATE_KEY_FILE_NAME" >> ~/.ssh/config

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

# Update the content from the `gh-pages` branch

$(npm bin)/update-branch --commands "npm run build-travis" \
                         --commit-message "Update gh-pages [skip ci]" \
                         --directory "out" \
                         --distribution-branch "gh-pages" \
                         --source-branch "master"

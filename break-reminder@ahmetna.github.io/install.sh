#!/bin/bash

# Extension UUID from metadata.json
UUID="break-reminder@ahmetna.github.io"
SOURCE_DIR=$(pwd)
DEST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Extension Deployment Script"
echo "Source: $SOURCE_DIR"
echo "Destination: $DEST_DIR"

# Create destination directory if it doesn't exist
if [ ! -d "$DEST_DIR" ]; then
    echo "Creating destination directory..."
    mkdir -p "$DEST_DIR"
fi

# Copy files
echo "Copying files..."
cp -r "$SOURCE_DIR"/* "$DEST_DIR/"

# Compile schemas
if [ -d "$DEST_DIR/schemas" ]; then
    echo "Compiling schemas..."
    glib-compile-schemas "$DEST_DIR/schemas"
fi

echo "Deployment complete!"
echo "Please reload GNOME Shell or disable/enable the extension to apply changes."
echo "If you are on Wayland, you may need to logout and login for a full reload if the extension code is cached."

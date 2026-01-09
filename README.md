# Break Reminder GNOME Extension

A GNOME Shell extension that reminds you to take breaks for your eyes and back every 20 minutes.

## Screenshot

![Break Reminder](Screenshot.png)

## Features

- Automatic break reminders every 20 minutes (configurable)
- Helps prevent eye strain and back pain
- 20-second countdown timer
- Configurable settings
- Clean, minimal modal dialog interface

## Requirements

- GNOME Shell 45 or later

No additional dependencies required! The extension uses native GNOME Shell APIs.

## Installation

### Manual Installation

1. Clone this repository:

```bash
git clone https://github.com/AhmetNA/Break_Reminder.git
cd Break_Reminder
```

2. Copy the extension to your GNOME extensions directory:

```bash
cp -r break-reminder@ahmetna.github.io ~/.local/share/gnome-shell/extensions/
```

3. Compile the settings schema:

```bash
cd ~/.local/share/gnome-shell/extensions/break-reminder@ahmetna.github.io
glib-compile-schemas schemas/
```

4. Restart GNOME Shell:

   - On X11: Press `Alt+F2`, type `r`, and press Enter
   - On Wayland: Log out and log back in

5. Enable the extension:

```bash
gnome-extensions enable break-reminder@ahmetna.github.io
```

## Configuration

Open Settings → Extensions → Break Reminder to configure:

- **Break Interval**: Minutes between break reminders (default: 20 minutes)
- **Break Duration**: Seconds to display break reminder (default: 20 seconds)

## Usage

Once enabled, the extension runs automatically. Every 20 minutes a modal dialog appears with a countdown timer. You can click "End Break" to dismiss early or wait for the timer to finish.

## Development

To view extension logs:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

## File Structure

```
break-reminder@ahmetna.github.io/
├── extension.js          # Main extension logic (timer control)
├── breakOverlay.js       # GNOME Shell overlay UI (break screen)
├── metadata.json         # Extension metadata
├── prefs.js             # Settings UI
├── stylesheet.css       # Styling
├── break_screen.py       # (Deprecated - not used)
└── schemas/             # Settings schema
    └── org.gnome.shell.extensions.break-reminder.gschema.xml
```

## License

Open source - feel free to use and modify.

## Troubleshooting

### Extension not showing up

```bash
gnome-extensions list
journalctl -f -o cat /usr/bin/gnome-shell
```

### Settings schema not found

```bash
cd ~/.local/share/gnome-shell/extensions/break-reminder@ahmetna.github.io
glib-compile-schemas schemas/
```

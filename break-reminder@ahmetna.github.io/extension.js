import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class BreakReminderExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._timeoutId = null;
        this._settings = null;
        this._settingsChangedId = null;
        this._scriptPath = null;
    }

    enable() {
        this._scriptPath = this.path + '/break_screen.py';
        this._settings = this.getSettings();

        // Settings değişikliğini dinle
        this._settingsChangedId = this._settings.connect('changed::break-duration', () => {
            this._startTimer();
        });

        this._startTimer();
    }

    disable() {
        // Remove main loop source
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        // Disconnect signal
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        // Cleanup settings reference
        this._settings = null;
    }

    _startTimer() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
        }

        // Settings dosyasından oku
        const breakDuration = this._settings.get_int('break-duration');

        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, breakDuration, () => {
            this._showBreakScreen();
            return GLib.SOURCE_REMOVE;
        });
    }

    _showBreakScreen() {
        try {
            // Pause media before showing break screen
            this._pauseMedia();

            // Launch Python GTK application
            let proc = Gio.Subprocess.new(
                ['python3', this._scriptPath],
                Gio.SubprocessFlags.NONE
            );

            // When the break screen closes, restart the timer
            proc.wait_async(null, () => {
                this._startTimer();
            });
        } catch (e) {
            logError(e, 'Failed to launch break screen');
            // Restart timer even on error
            this._startTimer();
        }
    }

    _pauseMedia() {
        try {
            // Use playerctl to pause all media players
            let proc = Gio.Subprocess.new(
                ['playerctl', '-a', 'pause'],
                Gio.SubprocessFlags.NONE
            );

            // We don't need to wait for this to finish
        } catch (e) {
            // Log error but don't let it stop the break screen from showing
            logError(e, 'Failed to pause media');
        }
    }
}
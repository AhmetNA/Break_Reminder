import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class BreakReminderExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._timeoutId = null;
        this._breakDuration = 20 * 60; // 20 minutes (in seconds)
        this._scriptPath = null;
    }

    enable() {
        this._scriptPath = this.path + '/break_screen.py';
        this._startTimer();
    }

    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }
    }

    _startTimer() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
        }

        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._breakDuration, () => {
            this._showBreakScreen();
            return GLib.SOURCE_REMOVE;
        });
    }

    _showBreakScreen() {
        try {
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
}
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class BreakReminderExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._timeoutId = null;
        this._playingPlayers = [];
        this._breakActive = false;
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
        this._playingPlayers = [];
        this._breakActive = false;
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
            this._breakActive = true;

            // Pause media before showing break screen
            this._pauseMedia();

            // Launch Python GTK application
            let proc = Gio.Subprocess.new(
                ['python3', this._scriptPath],
                Gio.SubprocessFlags.NONE
            );

            // When the break screen closes, restart the timer
            proc.wait_async(null, () => {
                this._breakActive = false;
                this._resumeMedia();
                this._startTimer();
            });
        } catch (e) {
            logError(e, 'Failed to launch break screen');
            // Restart timer even on error
            this._breakActive = false;
            this._startTimer();
        }
    }

    _pauseMedia() {
        try {
            // Reset playing players list
            this._playingPlayers = [];

            // 1. Get status of all players
            // Format: playerName:status
            let proc = Gio.Subprocess.new(
                ['playerctl', '-a', 'metadata', '--format', '{{playerName}}:{{status}}'],
                Gio.SubprocessFlags.STDOUT_PIPE
            );

            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    // Check if break is still active
                    if (!this._breakActive) return;

                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (stdout) {
                        let lines = stdout.trim().split('\n');
                        for (let line of lines) {
                            let parts = line.split(':');
                            if (parts.length >= 2) {
                                let name = parts[0];
                                let status = parts[1];
                                if (status === 'Playing') {
                                    this._playingPlayers.push(name);
                                }
                            }
                        }
                    }
                } catch (e) {
                    logError(e, 'Failed to get player metadata');
                }

                // 2. Pause all players after checking status
                try {
                    if (this._breakActive) {
                        Gio.Subprocess.new(
                            ['playerctl', '-a', 'pause'],
                            Gio.SubprocessFlags.NONE
                        );
                    }
                } catch (e) {
                    logError(e, 'Failed to pause players');
                }
            });

        } catch (e) {
            // Log error but don't let it stop the break screen from showing
            logError(e, 'Failed to pause media');
        }
    }

    _resumeMedia() {
        try {
            if (this._playingPlayers.length > 0) {
                // Resume all previously playing players
                for (let player of this._playingPlayers) {
                    Gio.Subprocess.new(
                        ['playerctl', '-p', player, 'play'],
                        Gio.SubprocessFlags.NONE
                    );
                }
                // Clear the list after resuming
                this._playingPlayers = [];
            }
        } catch (e) {
            logError(e, 'Failed to resume media');
        }
    }
}
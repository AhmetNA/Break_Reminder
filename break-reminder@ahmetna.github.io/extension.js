import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { BreakOverlay } from './breakOverlay.js';

export default class BreakReminderExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._timeoutId = null;
        this._playingPlayers = [];
        this._breakActive = false;
        this._overlay = null;
        this._screenLockId = null;
    }

    enable() {
        this._settings = this.getSettings();

        // Settings değişikliğini dinle
        this._settingsChangedId = this._settings.connect('changed::break-duration', () => {
            this._startTimer();
        });

        // Watch for screen lock
        this._screenLockId = Main.screenShield.connect('locked-changed', (shield) => {
            this._onScreenLockChanged(shield);
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

        // Disconnect screen lock signal
        if (this._screenLockId) {
            Main.screenShield.disconnect(this._screenLockId);
            this._screenLockId = null;
        }

        // Cleanup overlay if active
        if (this._overlay) {
            this._overlay.destroy();
            this._overlay = null;
        }

        // Cleanup settings reference
        this._settings = null;
        this._playingPlayers = [];
        this._breakActive = false;
    }

    _onScreenLockChanged(shield) {
        if (shield.locked) {
            // Screen locked: stop timer
            if (this._timeoutId) {
                GLib.Source.remove(this._timeoutId);
                this._timeoutId = null;
            }
        } else {
            // Screen unlocked: restart timer
            this._startTimer();
        }
    }

    _startTimer(duration = null) {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
        }

        // Use provided duration or read from settings
        const breakDuration = duration || this._settings.get_int('break-duration');

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

            // Create and show native GNOME Shell overlay
            this._overlay = new BreakOverlay(this._settings);

            // When the break screen closes, restart the timer
            this._overlay.connect('closed', () => {
                this._breakActive = false;
                this._overlay = null;
                this._resumeMedia();
                this._startTimer();
            });

            this._overlay.connect('snooze', () => {
                this._breakActive = false;
                this._overlay = null;
                this._resumeMedia();
                this._startTimer(3600); // 1 hour snooze
            });

            this._overlay.show();
        } catch (e) {
            logError(e, 'Failed to show break screen');
            // Restart timer even on error
            this._breakActive = false;
            this._overlay = null;
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
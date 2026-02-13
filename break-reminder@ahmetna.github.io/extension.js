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
        this._fullscreenChangedId = null;
        this._pendingBreak = false; // Break waiting for fullscreen to end
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

        // Watch for fullscreen changes
        this._fullscreenChangedId = global.display.connect('in-fullscreen-changed', () => {
            this._onFullscreenChanged();
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

        // Disconnect fullscreen signal
        if (this._fullscreenChangedId) {
            global.display.disconnect(this._fullscreenChangedId);
            this._fullscreenChangedId = null;
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
        this._pendingBreak = false;
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

    _isInFullscreen() {
        // Check if any monitor has a fullscreen window
        let numMonitors = global.display.get_n_monitors();
        for (let i = 0; i < numMonitors; i++) {
            if (global.display.get_monitor_in_fullscreen(i)) {
                return true;
            }
        }
        return false;
    }

    _onFullscreenChanged() {
        // If we have a pending break and fullscreen ended, show the break
        if (this._pendingBreak && !this._isInFullscreen()) {
            this._pendingBreak = false;
            this._showBreakScreen();
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
            // If in fullscreen, defer the break until fullscreen ends
            if (this._isInFullscreen()) {
                this._pendingBreak = true;
                return;
            }

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

    _getMprisPlayers() {
        try {
            let bus = Gio.DBus.session;
            let result = bus.call_sync(
                'org.freedesktop.DBus',
                '/org/freedesktop/DBus',
                'org.freedesktop.DBus',
                'ListNames',
                null,
                new GLib.VariantType('(as)'),
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );

            let [names] = result.deep_unpack();
            return names.filter(name => name.startsWith('org.mpris.MediaPlayer2.'));
        } catch (e) {
            logError(e, 'Failed to get MPRIS players');
            return [];
        }
    }

    _getPlayerStatus(busName) {
        try {
            let bus = Gio.DBus.session;
            let result = bus.call_sync(
                busName,
                '/org/mpris/MediaPlayer2',
                'org.freedesktop.DBus.Properties',
                'Get',
                new GLib.Variant('(ss)', ['org.mpris.MediaPlayer2.Player', 'PlaybackStatus']),
                new GLib.VariantType('(v)'),
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );

            let [variant] = result.deep_unpack();
            return variant.deep_unpack();
        } catch (e) {
            return null;
        }
    }

    _callPlayerMethod(busName, method) {
        try {
            let bus = Gio.DBus.session;
            bus.call_sync(
                busName,
                '/org/mpris/MediaPlayer2',
                'org.mpris.MediaPlayer2.Player',
                method,
                null,
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );
        } catch (e) {
            logError(e, `Failed to call ${method} on ${busName}`);
        }
    }

    _pauseMedia() {
        try {
            this._playingPlayers = [];

            let players = this._getMprisPlayers();
            for (let player of players) {
                let status = this._getPlayerStatus(player);
                if (status === 'Playing') {
                    this._playingPlayers.push(player);
                    if (this._breakActive) {
                        this._callPlayerMethod(player, 'Pause');
                    }
                }
            }
        } catch (e) {
            logError(e, 'Failed to pause media');
        }
    }

    _resumeMedia() {
        try {
            for (let player of this._playingPlayers) {
                this._callPlayerMethod(player, 'Play');
            }
            this._playingPlayers = [];
        } catch (e) {
            logError(e, 'Failed to resume media');
        }
    }
}
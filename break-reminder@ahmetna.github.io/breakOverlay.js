import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const BreakOverlay = GObject.registerClass({
    Signals: {
        'closed': {},
        'snooze': {},
    },
}, class BreakOverlay extends St.Widget {
    _init(settings) {
        super._init({
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_expand: true,
            y_expand: true,
            layout_manager: new Clutter.BinLayout(),
            style_class: 'break-overlay',
            style: 'background-color: rgba(51, 51, 51, 0.98);',
        });

        this._settings = settings;
        this._countdown = this._settings.get_int('countdown-duration');
        this._countdownId = null;
        this._grab = null;

        // Main container - fullscreen
        this._container = new St.BoxLayout({
            style_class: 'break-overlay-container',
            vertical: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
        });

        this.add_child(this._container);

        // Top spacer - for centering
        let topSpacer = new St.Widget({ y_expand: true });
        this._container.add_child(topSpacer);

        // Content box
        let contentBox = new St.BoxLayout({
            style_class: 'break-overlay-content',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            style: 'spacing: 30px;',
        });
        this._container.add_child(contentBox);

        // Main message
        this._messageLabel = new St.Label({
            style_class: 'break-overlay-message',
            text: 'Take a Break for Your Eyes and Back!\nTake a deep breath.',
        });
        this._messageLabel.clutter_text.set_line_alignment(2); // Center
        contentBox.add_child(this._messageLabel);

        // Countdown label
        this._countdownLabel = new St.Label({
            style_class: 'break-overlay-countdown',
            text: `${this._countdown}`,
        });
        contentBox.add_child(this._countdownLabel);

        // Bottom spacer
        let bottomSpacer = new St.Widget({ y_expand: true });
        this._container.add_child(bottomSpacer);

        // Buttons box - at the bottom
        let closeBox = new St.BoxLayout({
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'break-overlay-close-box',
            vertical: true,
            style: 'spacing: 20px;',
        });
        this._container.add_child(closeBox);

        this._closeButton = new St.Button({
            style_class: 'break-overlay-close-button',
            label: 'End Break',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        this._closeButton.connect('clicked', () => this._onClose());
        closeBox.add_child(this._closeButton);

        this._snoozeButton = new St.Button({
            style_class: 'break-overlay-close-button',
            label: 'Stop for 1 hour',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        this._snoozeButton.connect('clicked', () => this._onSnooze());
        closeBox.add_child(this._snoozeButton);

        // For keyboard events
        this.connect('key-press-event', (actor, event) => {
            let symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Escape) {
                this._onClose();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    show() {
        // Add to screen
        Main.layoutManager.addTopChrome(this, {
            affectsStruts: false,
            trackFullscreen: true,
        });

        // Set to fullscreen size
        let monitor = Main.layoutManager.primaryMonitor;
        this.set_position(monitor.x, monitor.y);
        this.set_size(monitor.width, monitor.height);

        // Grab input
        this._grab = Main.pushModal(this, {
            actionMode: 1, // Shell.ActionMode.NORMAL
        });

        // Fade-in animation
        this.opacity = 0;
        this.ease_property('opacity', 255, {
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        // Grab focus
        this.grab_key_focus();

        // Start countdown
        this._startCountdown();
    }

    hide() {
        // Stop countdown
        if (this._countdownId) {
            GLib.Source.remove(this._countdownId);
            this._countdownId = null;
        }

        // Fade-out animation
        this.ease_property('opacity', 0, {
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                // Release input grab
                if (this._grab) {
                    Main.popModal(this._grab);
                    this._grab = null;
                }

                // Remove from screen
                Main.layoutManager.removeChrome(this);

                // Remove from parent widget and destroy
                if (this.get_parent()) {
                    this.get_parent().remove_child(this);
                }
                this.destroy();
            },
        });
    }

    _startCountdown() {
        if (this._countdownId) {
            GLib.Source.remove(this._countdownId);
            this._countdownId = null;
        }

        this._countdownId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._countdown--;
            this._countdownLabel.set_text(`${this._countdown}`);

            if (this._countdown <= 0) {
                this._onClose();
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        });
    }

    _onClose() {
        this.emit('closed');
        this.hide();
    }

    _onSnooze() {
        this.emit('snooze');
        this.hide();
    }

    destroy() {
        // Cleanup
        if (this._countdownId) {
            GLib.Source.remove(this._countdownId);
            this._countdownId = null;
        }

        if (this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }

        super.destroy();
    }
});

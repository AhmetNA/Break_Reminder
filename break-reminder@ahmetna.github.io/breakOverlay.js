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
        });

        this._settings = settings;
        this._countdown = this._settings.get_int('countdown-duration');
        this._countdownId = null;
        this._grab = null;

        // Ana container - tam ekran
        this._container = new St.BoxLayout({
            style_class: 'break-overlay-container',
            vertical: true,
            x_expand: true,
            y_expand: true,
        });

        this.add_child(this._container);

        // Üst spacer - ortalamak için
        let topSpacer = new St.Widget({ y_expand: true });
        this._container.add_child(topSpacer);

        // İçerik box'ı
        let contentBox = new St.BoxLayout({
            style_class: 'break-overlay-content',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._container.add_child(contentBox);

        // Ana mesaj
        this._messageLabel = new St.Label({
            style_class: 'break-overlay-message',
            text: 'Gözlerin ve Sırtın İçin Mola Ver!\nDerin bir nefes al.',
        });
        this._messageLabel.clutter_text.set_line_alignment(2); // Center
        contentBox.add_child(this._messageLabel);

        // Countdown label
        this._countdownLabel = new St.Label({
            style_class: 'break-overlay-countdown',
            text: `${this._countdown}`,
        });
        contentBox.add_child(this._countdownLabel);

        // Alt spacer
        let bottomSpacer = new St.Widget({ y_expand: true });
        this._container.add_child(bottomSpacer);

        // Buttons box - en altta
        let closeBox = new St.BoxLayout({
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'break-overlay-close-box',
            vertical: true,
            spacing: 20
        });
        this._container.add_child(closeBox);

        this._closeButton = new St.Button({
            style_class: 'break-overlay-close-button',
            label: 'Molayı Bitir',
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

        // Klavye eventi için
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
        // Ekrana ekle
        Main.layoutManager.addChrome(this, {
            affectsStruts: false,
            trackFullscreen: true,
        });

        // Tam ekran boyutuna ayarla
        let monitor = Main.layoutManager.primaryMonitor;
        this.set_position(monitor.x, monitor.y);
        this.set_size(monitor.width, monitor.height);

        // Input'u yakala
        this._grab = Main.pushModal(this, {
            actionMode: 1, // Shell.ActionMode.NORMAL
        });

        // Fade-in animasyonu
        this.opacity = 0;
        this.ease_property('opacity', 255, {
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        // Focus al
        this.grab_key_focus();

        // Countdown başlat
        this._startCountdown();
    }

    hide() {
        // Countdown'u durdur
        if (this._countdownId) {
            GLib.Source.remove(this._countdownId);
            this._countdownId = null;
        }

        // Fade-out animasyonu
        this.ease_property('opacity', 0, {
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                // Input yakalamayı bırak
                if (this._grab) {
                    Main.popModal(this._grab);
                    this._grab = null;
                }

                // Ekrandan kaldır
                Main.layoutManager.removeChrome(this);

                // Parent widget'tan çıkar ve yok et
                if (this.get_parent()) {
                    this.get_parent().remove_child(this);
                }
                this.destroy();
            },
        });
    }

    _startCountdown() {
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

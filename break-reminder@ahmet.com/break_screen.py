#!/usr/bin/env python3
import sys
import gi
gi.require_version('Gtk', '4.0')
from gi.repository import Gtk, GLib, Gdk

class BreakWindow(Gtk.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title="Break Time")
        self.app = app
        self.countdown = 20

        self.fullscreen()

        css_provider = Gtk.CssProvider()
        css_data = """
        window {
            background-color: #333333;
        }
        label.main-text {
            color: white;
            font-size: 40px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        label.close-button {
            color: #999999;
            font-size: 16px;
            padding: 5px 10px;
        }
        label.close-button:hover {
            color: #cccccc;
            text-decoration: underline;
        }
        label.countdown {
            color: #888888;
            font-size: 80px;
            font-weight: bold;
        }
        """
        css_provider.load_from_data(css_data.encode())
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            css_provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.set_child(main_box)

        top_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=20)
        top_box.set_halign(Gtk.Align.CENTER)
        top_box.set_valign(Gtk.Align.CENTER)
        top_box.set_vexpand(True)
        main_box.append(top_box)

        label = Gtk.Label(label="Take a Break for Your Eyes and Back!\nTake a deep breath.")
        label.add_css_class("main-text")
        label.set_justify(Gtk.Justification.CENTER)
        top_box.append(label)

        self.countdown_label = Gtk.Label(label=f"{self.countdown}")
        self.countdown_label.add_css_class("countdown")
        top_box.append(self.countdown_label)

        spacer = Gtk.Box()
        spacer.set_vexpand(True)
        main_box.append(spacer)

        close_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=5)
        close_box.set_halign(Gtk.Align.CENTER)
        close_box.set_valign(Gtk.Align.END)
        close_box.set_margin_bottom(300)
        main_box.append(close_box)

        close_label = Gtk.Label(label="End Break")
        close_label.add_css_class("close-button")
        gesture = Gtk.GestureClick.new()
        gesture.connect("pressed", self.on_close)
        close_label.add_controller(gesture)
        close_box.append(close_label)

        # Start countdown
        GLib.timeout_add_seconds(1, self.update_countdown)

    def update_countdown(self):
        if self.countdown > 0:
            self.countdown -= 1
            self.countdown_label.set_label(f"{self.countdown}")
            if self.countdown == 0:
                self.on_close(None)
                return False
            return True
        return False

    def on_close(self, widget, *args):
        self.app.quit()

app = Gtk.Application(application_id="com.ahmet.breakscreen")
app.connect('activate', lambda a: BreakWindow(a).present())
app.run(None)
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BreakReminderPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Break Settings',
            description: 'Configure your break reminder settings'
        });
        page.add(group);

        const breakDurationRow = new Adw.SpinRow({
            title: 'Break Interval',
            subtitle: 'Minutes between break reminders',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 120,
                step_increment: 5,
                page_increment: 10,
                value: settings.get_int('break-duration') / 60
            })
        });

        breakDurationRow.connect('changed', () => {
            settings.set_int('break-duration', breakDurationRow.value * 60);
        });

        group.add(breakDurationRow);

        const countdownRow = new Adw.SpinRow({
            title: 'Break Duration',
            subtitle: 'Seconds to display break reminder',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 60,
                step_increment: 5,
                page_increment: 10,
                value: settings.get_int('countdown-duration')
            })
        });

        countdownRow.connect('changed', () => {
            settings.set_int('countdown-duration', countdownRow.value);
        });

        group.add(countdownRow);

        window.add(page);
    }
}

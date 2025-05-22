import time
import datetime
import threading
import tkinter as tk
from tkinter import messagebox
from bs4 import BeautifulSoup
import webbrowser
import os

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import WebDriverException

try:
    from playsound import playsound
    SOUND_OK = True
except ImportError:
    SOUND_OK = False

import requests

# ==== EINSTELLUNGEN ANPASSEN ====
TIKTOK_USERNAMES = [
    "biyoenerjii.reiki.sifa",
    "nura_m.h",
    "siirkizgozde",
    "baliqci_qiz",
    "gozdeyedekhesapi"
]
CHECK_INTERVAL = 60  # Sekunden
PUSHOVER_USER_KEY = "ufdtfd3dyweuk7ytya7m5h5ttizw3x"
PUSHOVER_API_TOKEN = "ahxvqecvdkkyv3r61rrucvsfjrpxtx"
LOGFILE = "tiklog.txt"
SOUND_FILE = "sound.mp3"  # Optional
CHROMEDRIVER_PATH = "/Users/abdo/Desktop/website/iweb-2/css/chromedriver"
CHROME_BINARY = "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"

def check_tiktok_live_selenium(username, driver):
    url = f"https://www.tiktok.com/@{username}"
    try:
        driver.get(url)
        time.sleep(7)
        html = driver.page_source
        soup = BeautifulSoup(html, 'html.parser')

        # Suche das exakte LIVE-Badge per Klasse
        live_badge = soup.find("span", class_=lambda v: v and "SpanLiveBadge" in v)
        if live_badge and live_badge.get_text(strip=True).upper() == "LIVE":
            return True

        return False
    except WebDriverException as e:
        print(f"Selenium Fehler für @{username}: {e}")
        return None

def pushover_notify(usernames):
    msg = "Folgende Nutzer sind jetzt LIVE auf TikTok:\n"
    msg += "\n".join(f"@{u}: https://www.tiktok.com/@{u}" for u in usernames)
    data = {
        "token": PUSHOVER_API_TOKEN,
        "user": PUSHOVER_USER_KEY,
        "title": "TikTok LIVE Alarm",
        "message": msg,
        "priority": 1
    }
    try:
        requests.post("https://api.pushover.net/1/messages.json", data=data, timeout=5)
    except Exception as e:
        print(f"Pushover Fehler: {e}")

def write_log(msg):
    try:
        with open(LOGFILE, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception as e:
        print("Logfehler:", e)

class TikTokLiveCheckerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("TikTok Multi-User Live Status Checker")
        self.status_labels = {}
        self.check_labels = {}
        self.live_labels = {}
        self.was_live = {u: False for u in TIKTOK_USERNAMES}
        self.last_checked = {u: "Nie" for u in TIKTOK_USERNAMES}
        self.last_live = {u: "Nie" for u in TIKTOK_USERNAMES}
        self.checking = True

        # Korrekte Initialisierung mit Service UND binary_location!
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.binary_location = CHROME_BINARY
        self.driver = webdriver.Chrome(service=Service(CHROMEDRIVER_PATH), options=chrome_options)

        tk.Label(root, text="TikTok Live Status (klickbarer Username):", font=("Helvetica", 16)).pack(pady=(10, 5))

        for username in TIKTOK_USERNAMES:
            frame = tk.Frame(root, pady=2)
            frame.pack(fill="x", padx=12)
            user_label = tk.Label(frame, text=f"@{username}", font=("Helvetica", 13, "underline"), fg="blue", cursor="hand2", width=18, anchor="w")
            user_label.pack(side="left")
            user_label.bind("<Button-1>", lambda e, u=username: webbrowser.open(f"https://www.tiktok.com/@{u}"))

            status_label = tk.Label(frame, text="Status: Prüfe...", font=("Helvetica", 13), width=11, anchor="w", bg="#f3f3f3")
            status_label.pack(side="left", padx=(8, 0))
            check_label = tk.Label(frame, text="Letzter Check: -", font=("Helvetica", 11), width=21, anchor="w")
            check_label.pack(side="left", padx=(10, 0))
            live_label = tk.Label(frame, text="Zuletzt LIVE: -", font=("Helvetica", 11), width=20, anchor="w")
            live_label.pack(side="left", padx=(5, 0))
            self.status_labels[username] = status_label
            self.check_labels[username] = check_label
            self.live_labels[username] = live_label

        btn = tk.Button(root, text="Jetzt prüfen", font=("Helvetica", 13), command=self.update_status_direct)
        btn.pack(pady=10)

        self.update_status()

    def update_status(self):
        def check_all():
            live_now = []
            now = datetime.datetime.now().strftime("%d.%m.%Y %H:%M:%S")
            for username in TIKTOK_USERNAMES:
                is_live = check_tiktok_live_selenium(username, self.driver)
                status = "LIVE" if is_live else "OFFLINE"
                self.status_labels[username].config(
                    text=f"Status: {status}",
                    bg="#e84c3d" if is_live else "#4a90e2",
                    fg="white"
                )
                self.check_labels[username].config(text=f"Letzter Check: {now}")
                self.last_checked[username] = now
                if is_live:
                    self.live_labels[username].config(text=f"Zuletzt LIVE: {now}")
                    if not self.was_live[username]:
                        live_now.append(username)
                        self.last_live[username] = now
                        write_log(f"{now} - @{username} ist LIVE")
                self.was_live[username] = is_live
            if live_now:
                self.show_live_popup(live_now)
                pushover_notify(live_now)
                if SOUND_OK and os.path.exists(SOUND_FILE):
                    try:
                        playsound(SOUND_FILE, block=False)
                    except Exception as e:
                        print("Sound Fehler:", e)
            if self.checking:
                self.root.after(CHECK_INTERVAL * 1000, self.update_status)
        threading.Thread(target=check_all, daemon=True).start()

    def update_status_direct(self):
        self.update_status()

    def show_live_popup(self, usernames):
        msg = "\n".join(f"@{u} ist jetzt LIVE!" for u in usernames)
        messagebox.showinfo("TikTok LIVE", msg)

    def __del__(self):
        try:
            self.driver.quit()
        except Exception:
            pass

if __name__ == "__main__":
    root = tk.Tk()
    app = TikTokLiveCheckerApp(root)
    root.mainloop()
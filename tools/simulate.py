import asyncio
import json
import random
import time
import numpy as np
import cv2
import base64
import requests

class RoboMasterBot:
    def __init__(self):
        # Basic state
        self.position = [0, 0]  # meters
        self.orientation = 0  # degrees

        # System metrics for graphing
        self.battery_voltage = 24.0
        self.cpu_temp = 45.0
        self.signal_strength = -50
        self.latency = 15

        # Status strings
        self.mode = "AUTONOMOUS"
        self.game_state = "SETUP"
        self.system_health = "OK"

    def update(self):
        # Update position
        self.position[0] += random.uniform(-0.1, 0.1)
        self.position[1] += random.uniform(-0.1, 0.1)
        self.orientation = (self.orientation + random.uniform(-1, 1)) % 360

        # Update metrics
        self.battery_voltage = max(20.0, self.battery_voltage - random.uniform(0, 0.01))
        self.cpu_temp = max(35, min(85, self.cpu_temp + random.uniform(-0.5, 0.5)))
        self.signal_strength = max(-90, min(-30, self.signal_strength + random.uniform(-2, 2)))
        self.latency = max(5, min(100, self.latency + random.uniform(-2, 2)))

        cv_mat = (np.random.rand(120, 160) * 255).astype(np.uint8)
        _, jpeg_data = cv2.imencode('.jpg', cv_mat)
        cv_mat_base64 = base64.b64encode(jpeg_data).decode()

        current_time = int(time.time() * 1000)

        return {
            "sent_timestamp": current_time,
            "images": {
                "main_camera": {
                    "image_data": cv_mat_base64,
                    "scale": 1,
                    "flip": False
                },
                "thermal_camera": {
                    "image_data": cv_mat_base64,
                    "scale": 1,
                    "flip": False
                }
            },
            "graph_data": {
                "Battery_Voltage": [{
                    "timestamp": current_time,
                    "value": self.battery_voltage
                }],
                "CPU_Temperature": [{
                    "timestamp": current_time,
                    "value": self.cpu_temp
                }],
                "Signal_Strength": [{
                    "timestamp": current_time,
                    "value": self.signal_strength
                }],
                "Latency": [{
                    "timestamp": current_time,
                    "value": self.latency
                }]
            },
            "string_data": {
                "mode": {"value": self.mode},
                "game_state": {"value": self.game_state},
                "system_health": {"value": self.system_health}
            },
            "robot_position": {
                "x": self.position[0],
                "y": self.position[1],
                "heading": self.orientation
            }
        }

if __name__ == "__main__":
    bot = RoboMasterBot()
    while True:
        data = json.dumps(bot.update())
        URL = "http://localhost:3000/batch"

        try:
            r = requests.post(url=URL, data=data)
            print(f"Data sent at {time.time()}")
        except:
            print("Failed to send data to server")
            time.sleep(1)

        time.sleep(0.05)

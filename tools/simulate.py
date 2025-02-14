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
        self.position = [0., 0.]
        self.orientation = 0

        self.yaw = 24.0
        self.pitch = 45.0


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
        self.yaw = (self.yaw - random.uniform(0, 0.5)) %( 2*3.14159)
        self.pitch = min(85, self.pitch + random.uniform(-0.5, 0.5))

        cv_mat = (np.random.rand(250, 500) * 255).astype(np.uint8)
        _, jpeg_data = cv2.imencode('.jpg', cv_mat)
        cv_mat_base64 = base64.b64encode(jpeg_data).decode()

        current_time = int(time.time() * 1000)

        return {
            "sent_timestamp": current_time,
            "images": {
                "main_camera (this is all simulated data btw)": {
                    "image_data": cv_mat_base64,
                    "scale": 1,
                    "flip": False
                },
                "world_map": {
                    "image_data": cv_mat_base64,
                    "scale": 1,
                    "flip": False
                }
            },
            "graph_data": {
                "Turret Yaw": [{
                    "timestamp": current_time,
                    "value": self.yaw
                }],
                "Turret Pitch": [{
                    "timestamp": current_time,
                    "value": self.pitch
                }],

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

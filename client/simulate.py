import asyncio
import websockets
import json
import math
import random
import time
import numpy as np
from datetime import datetime

class RoboMasterBot:
    def __init__(self):
        # Basic state
        self.position = [0, 0]  # meters
        self.orientation = 0  # degrees
        self.mode = "AUTONOMOUS"
        self.game_state = "SETUP"
        self.score = 0
        
        # System health
        self.battery_voltage = 24.0  # volts
        self.battery_current = 0.0   # amps
        self.cpu_temp = 45.0         # celsius
        self.system_health = "OK"
        
        # Motors
        self.motor_temps = {
            "front_left": 35.0,
            "front_right": 35.0,
            "back_left": 35.0,
            "back_right": 35.0,
            "gimbal_yaw": 30.0,
            "gimbal_pitch": 30.0
        }
        self.motor_currents = {k: 0.0 for k in self.motor_temps.keys()}
        
        # Weapon systems
        self.ammo_count = 200
        self.shots_fired = 0
        self.barrel_temp = 25.0
        
        # Communications
        self.signal_strength = -50  # dBm
        self.latency = 15          # ms
        self.packet_loss = 0.1     # percentage
        
        # Vision system
        self.target_acquired = False
        self.vision_fps = 60
        self.detection_confidence = 0.0

    def update(self):
        # Simulate movement
        self.position[0] += random.uniform(-0.1, 0.1)
        self.position[1] += random.uniform(-0.1, 0.1)
        self.orientation = (self.orientation + random.uniform(-1, 1)) % 360
        
        # Simulate system changes
        self.battery_voltage = max(20.0, self.battery_voltage - random.uniform(0, 0.01))
        self.cpu_temp = max(35, min(85, self.cpu_temp + random.uniform(-0.5, 0.5)))
        
        # Update motor temperatures
        for motor in self.motor_temps:
            self.motor_temps[motor] += random.uniform(-0.2, 0.3)
            self.motor_temps[motor] = max(25, min(75, self.motor_temps[motor]))
            self.motor_currents[motor] = abs(random.gauss(2, 0.5))
        
        # Update communication metrics
        self.signal_strength = max(-90, min(-30, self.signal_strength + random.uniform(-2, 2)))
        self.latency = max(5, min(100, self.latency + random.uniform(-2, 2)))
        
        # Simulate vision system
        self.target_acquired = random.random() > 0.7
        self.detection_confidence = random.random() if self.target_acquired else 0.0
        
        # Generate dummy CV mat data (simulating a basic grayscale image)
        cv_mat = (np.random.rand(120, 160) * 255).astype(np.uint8)
        _, jpeg_data = cv2.imencode('.jpg', cv_mat)
        cv_mat_base64 = base64.b64encode(jpeg_data).decode()

        return {
            "timestamp": time.time(),
            "type": "batch",
            "data": {
                "status": {
                    "mode": self.mode,
                    "game_state": self.game_state,
                    "system_health": self.system_health,
                    "score": self.score
                },
                "position": {
                    "x": self.position[0],
                    "y": self.position[1],
                    "orientation": self.orientation
                },
                "power": {
                    "battery_voltage": self.battery_voltage,
                    "battery_current": self.battery_current,
                    "cpu_temp": self.cpu_temp
                },
                "motors": {
                    "temperatures": self.motor_temps,
                    "currents": self.motor_currents
                },
                "weapons": {
                    "ammo_count": self.ammo_count,
                    "shots_fired": self.shots_fired,
                    "barrel_temp": self.barrel_temp
                },
                "communications": {
                    "signal_strength": self.signal_strength,
                    "latency": self.latency,
                    "packet_loss": self.packet_loss
                },
                "vision": {
                    "target_acquired": self.target_acquired,
                    "fps": self.vision_fps,
                    "confidence": self.detection_confidence
                },
                "cv-mats": {
                    "main_camera": cv_mat_base64,
                    "thermal_camera": cv_mat_base64  # You could generate different dummy data for this
                },
                "graphable-numbers": {
                    "Battery_Voltage": [self.battery_voltage],
                    "CPU_Temperature": [self.cpu_temp],
                    "Motor_Temperatures": [sum(self.motor_temps.values()) / len(self.motor_temps)],
                    "Signal_Strength": [self.signal_strength],
                    "Latency": [self.latency]
                }
            }
        }

async def broadcast_data(websocket, bot):
    try:
        while True:
            data = bot.update()
            await websocket.send(json.dumps(data))
            await asyncio.sleep(0.05)  # 20Hz update rate
    except websockets.exceptions.ConnectionClosed:
        pass

async def handle_connection(websocket, path):
    bot = RoboMasterBot()
    await broadcast_data(websocket, bot)

async def main():
    server = await websockets.serve(handle_connection, "localhost", 8765)
    print("Server started on ws://localhost:8765")
    await server.wait_closed()

if __name__ == "__main__":
    import cv2
    import base64
    asyncio.run(main())

class Enemy:
    SPEED = 120.0  # pixels per second

    def __init__(self):
        self.x = 0.0

    def update(self, dt):
        self.x += self.SPEED * dt


class Player:
    def __init__(self):
        self.x = 0.0

    def update(self, dt):
        pass

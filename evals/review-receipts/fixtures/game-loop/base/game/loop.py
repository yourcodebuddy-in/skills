def step(entities, dt):
    for entity in entities:
        entity.update(dt)

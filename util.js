function rand(min, max) {
    return Math.random() * (max - min + 1) + min;
}

function randomPosition(starting_mass, grid_x, grid_y) {
    const buffer = starting_mass / 2
    const starting_x = rand(buffer, grid_x - buffer);
    const starting_y = rand(buffer, grid_y - buffer)
    return {
        x: starting_x,
        y: starting_y
    }
}

module.exports =  {rand, randomPosition}
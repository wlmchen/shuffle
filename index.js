const express = require('express')
const { randomPosition, rand } = require('./util')
const app = express()
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require("./openapi.json")
const port = 80

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

const GRID_X = 100
const GRID_Y = 100
const STARTING_MASS = 3
const VELOCITY = 1

const DOTS = {} // ip: object
const NEXT_FETCH = {} // ip: unix
const TOAD = randomPosition(1, GRID_X, GRID_Y)

const WALL = {
    0: "top",
    1: "bottom",
    2: "left",
    3: "right"
}

let BAD_WALL = 0

Array.prototype.random = function () {
    return this[Math.floor((Math.random() * this.length))];
}
const clamp = (num, min, max) => Math.min(Math.max(num, min), max)

function pickNewWall() {
    const possibleWalls = Object.keys(WALL).filter(wall => wall != BAD_WALL)
    BAD_WALL = possibleWalls.random()
}

let lastUpdateTime = Date.now()

function isAlive(req) {
    return req.ip in DOTS
}

function updateState() {
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastUpdateTime)/1000
    lastUpdateTime = currentTime

    Object.values(DOTS).forEach(dot => {
        dot.x += VELOCITY * deltaTime * Math.cos(dot.direction)
        dot.y += VELOCITY * deltaTime * Math.sin(dot.direction)
    
        dot.x = clamp(dot.x, 0+dot.mass/2, GRID_X-dot.mass/2)
        dot.y = clamp(dot.y, 0+dot.mass/2, GRID_Y-dot.mass/2)

        // if dot touching toad, increase mass
        const toad_dx = dot.x - TOAD.x
        const toad_dy = dot.y - TOAD.y
        const toad_dist = Math.sqrt(toad_dx*toad_dx + toad_dy*toad_dy)
        if (toad_dist < dot.mass/2 + 1/2) {
            dot.mass += 1
            TOAD = randomPosition(1, GRID_X, GRID_Y)
        }
        if (WALL[BAD_WALL] === "top" && dot.y-dot.mass/2 < 0) {
            delete DOTS[dot.ip]
            return
        }
        if (WALL[BAD_WALL] === "bottom" && dot.y+dot.mass/2 > GRID_Y) {
            delete DOTS[dot.ip]
            return
        }
        if (WALL[BAD_WALL] === "left" && dot.x-dot.mass/2 < 0) {
            delete DOTS[dot.ip]
            return
        }
        if (WALL[BAD_WALL] === "right" && dot.x+dot.mass/2 > GRID_X) {
            delete DOTS[dot.ip]
            return
        }
        Object.values(DOTS).forEach(otherDot => {
            if (dot === otherDot) return
            // distance between centers
            const dx = dot.x - otherDot.x
            const dy = dot.y - otherDot.y
            const distance = Math.sqrt(dx*dx + dy*dy)
            const minDistance = (dot.mass + otherDot.mass) / 2
            if (distance < minDistance) {
                 // reflect direction pi/2 if not touching wall, ensure resulting angle is within 0 to 2pi
                if (dot.x > 0+dot.mass/2 && dot.x < GRID_X-dot.mass/2 && dot.y+dot.mass/2 > 0 && dot.y < GRID_Y-dot.mass/2) {
                    dot.direction = (dot.direction + Math.PI) % (2 * Math.PI)
                }
                if (otherDot.x > 0+otherDot.mass/2 && otherDot.x < GRID_X-otherDot.mass/2 && otherDot.y > 0+otherDot.mass/2 && otherDot.y < GRID_Y-otherDot.mass/2) {
                    otherDot.direction = (otherDot.direction + Math.PI) % (2 * Math.PI)
                }
            }
        })
    })
}

app.use(express.json())

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/static/index.html')
})

app.post('/join', (req, res) => {
    if (isAlive(req)) return res.status(400).json("Your dot already exists!")
    const { name, direction } = req.body
    if (!name || isNaN(direction)) return res.status(400).json("Missing fields")
    const mass = STARTING_MASS
    const { x, y } = randomPosition(mass, GRID_X, GRID_Y)
    DOTS[req.ip] = {
        x: x,
        y: y,
        mass: mass,
        name: name,
        direction: direction,
    }
    return res.json({message: "dot joined"})
})

app.get('/board', (req, res) => {
    if (req.ip in NEXT_FETCH) {
        if (Date.now() < NEXT_FETCH[req.ip]) return res.status(429).json("You didn't wait long enough!")
        // haha 😈
        const interval = rand(3000, 5000)
        const next_fetch_time = Date.now() + interval;
        NEXT_FETCH[req.ip] = next_fetch_time
    }
    const sanitized_dots = Object.values(DOTS)
    res.json({
        dots: sanitized_dots,
        toad: TOAD,
        bad_wall: WALL[BAD_WALL]
    })
    // random interval between 3 and 5 seconds
    const interval = rand(3000, 5000)
    const next_fetch_time = Date.now() + interval;
    NEXT_FETCH[req.ip] = next_fetch_time
})

app.post('/direction', (req, res) => {
    if (!isAlive(req)) return res.status(401).json("Spawn first with /join!")
    const {direction} = req.body
    if (isNaN(direction)) return res.status(400).json("Direction not specified")
    DOTS[req.ip].direction = direction
    res.json({message: "Direction updated"})
})

app.get('/leaderboard', (req, res) => {
    const leaderboard = Object.values(DOTS).map((dot) => ({name: dot.name, mass: dot.mass})).sort((a, b) => a.mass - b.mass)
    res.json(leaderboard)
})

app.get('/howami', (req, res) => {
    if (!isAlive(req)) return res.status(401).json("Spawn first with /join!")
    return res.json({
        'x': DOTS[req.ip].x,
        'y': DOTS[req.ip].y,
        'mass': DOTS[req.ip].mass,
        'direction': DOTS[req.ip].direction
    })
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
    setInterval(updateState, 1000/10); // 10Hz
    setInterval(pickNewWall, 30*1000); // 30s
})

/*

TOADS

WALL
- which one
*/
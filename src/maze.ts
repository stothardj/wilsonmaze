// Maze generation gives up after this many generations and goes with whatever it's got.
const MAX_ITERATIONS = 50000000;

const CONNECT_TOP = 1;
const CONNECT_LEFT = 1 << 1;
const CONNECT_BOTTOM = 1 << 2;
const CONNECT_RIGHT = 1 << 3;

class Position {
	constructor(public readonly row: number, public readonly col: number) {
	}

	equals(other: Position): boolean {
		return this.row === other.row && this.col === other.col;
	}

	toString(): string {
		return `(${this.row}, ${this.col})`;
	}
}

class Maze {
	public cells: number[];

	constructor(readonly width: number, readonly height: number) {
		this.cells = new Array<number>(width * height).fill(0);
	}

	// Can be used to index into cells.
	cellIdx(row: number, col: number): number {
		return row * this.width + col;
	}

	// Should be faster than cellIdx, but cannot be used to index into cells.
	cellHash(row: number, col: number): number {
		return (row << 10) + col;
	}

	isInBounds(row: number, col: number): bool {
		return row >= 0 && row < this.height && col >= 0 && col < this.width;
	}
}

class PosWithDir {
	constructor(readonly p: Position, readonly d: Direction) {}
}

class Path {
	readonly pos: Position[];
	readonly dir: Direction[];
	// Maps cell index (in the map) to the array index in the pos list.
	// Allows fast backtracking for loop breaking.
	readonly posIdx: Map<number, number>;

	constructor(readonly maze: Maze, start: Position) {
		this.pos = [start];
		this.dir = [];
		this.posIdx = new Map<number, number>();
		this.posIdx.set(this.maze.cellHash(start.row, start.col), 0);
	}

	push(p: Position, d: Direction) {
		this.pos.push(p);
		this.dir.push(d);
		this.posIdx.set(this.maze.cellHash(p.row, p.col), this.pos.length-1);
	}

	pop(): PosWithDir {
		const p = this.pos.pop();
		this.posIdx.delete(this.maze.cellHash(p.row, p.col));
		return new PosWithDir(p, this.dir.pop());
	}

	popUntil(p: Position): Position[] {
		const h = this.maze.cellHash(p.row, p.col);
		const pIdx = this.posIdx.get(h);
		const numDelete = this.pos.length - pIdx - 1;
		const deleted = this.pos.splice(-numDelete, numDelete);
		this.dir.splice(-numDelete, numDelete);
		for (const d of deleted) {
			this.posIdx.delete(this.maze.cellHash(d.row, d.col));
		}
		return deleted;
	}
}

function logPathPos(path: Path): void {
	let ls: string[] = []
	for (const p of path.pos) {
		ls.push(p.toString());
	}
	console.log(ls.join(', '));
}

function logPathDir(path: Path): void {
	let ls: string[] = []
	for (const d of path.dir) {
		ls.push(dirToString(d));
	}
	console.log(ls.join(', '));
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values
// Minimum is inclusive. Maximum is exclusive.
function getRandomInt(min: number, max: number): number {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}

enum Direction {
	Up, Down, Left, Right,
}

function dirToString(dir: Direction) {
	switch (dir) {
		case Direction.Up:
			return 'up';
		case Direction.Down:
			return 'down';
		case Direction.Left:
			return 'left';
		case Direction.Right:
			return 'right';
	}
}

function isReverse(prev: Direction, curr: Direction): bool {
	switch (prev) {
		case Direction.Up:
			return curr === Direction.Down;
		case Direction.Down:
			return curr === Direction.Up;
		case Direction.Left:
			return curr === Direction.Right;
		case Direction.Right:
			return curr === Direction.Left;
	}
}

function getRandomDirection(): Direction {
	switch (getRandomInt(0, 4)) {
		case 0:
			return Direction.Up;
		case 1:
			return Direction.Left;
		case 2:
			return Direction.Down;
		case 3:
			return Direction.Right;
	}
}

function applyMove(row: number, col: number, dir: Direction): Position {
	switch (dir) {
		case Direction.Up:
			return new Position(row-1, col);
		case Direction.Left:
			return new Position(row, col-1);
		case Direction.Down:
			return new Position(row+1, col);
		case Direction.Right:
			return new Position(row, col+1);
	}
}

function generateMaze(width: number, height: number): Maze {
	const maze = new Maze(width, height);
	// Wilson's algorithm.
	// Here we use the "color" to determine which path added it to the maze.
	// Only used for loop erasure.
	// Things not in the maze do not yet have a color.
	const cellColor = new Map<number, number>();
	// List of all remaining cell indexes makes choosing a cell not yet added
	// to the maze easier. Requires some bookkeeping.
	let remainingCells: Position[] = [];
	for (let r=0; r<maze.height; r++) {
		for (let c=0; c<maze.width; c++) {
			remainingCells.push(new Position(r, c));
		}
	}
	// Choose a cell arbitrarility. Add it to the maze.
	cellColor.set(0, 1);
	// Create a path of currColor until we reach something currently in the maze (i.e. lower color).
	// If we hit something of currColor, we must erase the loop.
	let currColor = 1;
	let currPath: Path | null = null;
	let currPos: Position | null = null;

	for (let numIterations=0; numIterations < MAX_ITERATIONS; numIterations++) {
		// Start new path
		if (currPos === null) {
			const remainingIdx = getRandomInt(0, remainingCells.length);
			currPos = remainingCells[remainingIdx];
			currPath = new Path(maze, currPos);
			currColor++;
			cellColor.set(maze.cellHash(currPos.row, currPos.col), currColor);
			continue;
		}

		// Continue existing path

		// Sets currPos to new position
		let prevDirection = currPath.dir.at(-1);
		let direction = Direction.Up;
		for (;;) {
			// Choose a random direction. Make sure it's still on the board.
			direction = getRandomDirection();
			if (prevDirection !== undefined && isReverse(prevDirection, direction)) {
				// Doubling back not allowed. Try again.
				continue;
			}
			const nextPos = applyMove(currPos.row, currPos.col, direction);
			if (maze.isInBounds(nextPos.row, nextPos.col)) {
				currPos = nextPos;
				break;
			}
		}

		const currPosIdx = maze.cellHash(currPos.row, currPos.col);

		// Check what was there before
		const prevColor = cellColor.get(currPosIdx);

		if (prevColor === undefined) {
			// Not in the map yet.
			// Just keep going with current path.
			currPath.push(currPos, direction);
			cellColor.set(currPosIdx, currColor);
		} else if (prevColor === currColor) {
			// Loop! Must break it.
			// Delete everything in the path until we hit the currPos again.
			const deleted = currPath.popUntil(currPos);
			for (const d of deleted) {
				cellColor.delete(maze.cellHash(d.row, d.col));
			}
			currPath.push(currPos, direction);
			cellColor.set(currPosIdx, currColor);
		} else {
			// Connected to an existing path in the maze!
			// Finalize it.
			currPath.push(currPos, direction);

			// Remove all cells in the path from remainingCells.
			const pathIdxs = new Set<number>(currPath.pos.map((p) => maze.cellHash(p.row, p.col)));
			remainingCells = remainingCells.filter((p) => !pathIdxs.has(maze.cellHash(p.row, p.col)));
			// Make next iteration start a new path.
			currPos = null;

			for (let i=0; i<currPath.pos.length-1; i++) {
				const pFrom = currPath.pos[i];
				const pTo = currPath.pos[i+1];
				const dir = currPath.dir[i];
				const pFromIdx = maze.cellIdx(pFrom.row, pFrom.col);
				const pToIdx = maze.cellIdx(pTo.row, pTo.col);
				switch (dir) {
					case Direction.Up:
						maze.cells[pFromIdx] |= CONNECT_TOP;
						maze.cells[pToIdx] |= CONNECT_BOTTOM;
						break;
					case Direction.Down:
						maze.cells[pFromIdx] |= CONNECT_BOTTOM;
						maze.cells[pToIdx] |= CONNECT_TOP;
						break;
					case Direction.Left:
						maze.cells[pFromIdx] |= CONNECT_LEFT;
						maze.cells[pToIdx] |= CONNECT_RIGHT;
						break;
					case Direction.Right:
						maze.cells[pFromIdx] |= CONNECT_RIGHT;
						maze.cells[pToIdx] |= CONNECT_LEFT;
						break;
				}
			}
		}

		if (remainingCells.length === 0) {
			break;
		}
	}
	return maze;
}

function drawMaze(maze: Maze, ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
	const areaWidth = x2 - x1;
	const areaHeight = y2 - y1;
	const cellWidth = areaWidth / maze.width;
	const cellHeight = areaHeight / maze.height;
	for (let r=0; r<maze.height; r++) {
		for (let c=0; c<maze.width; c++) {
			const idx = maze.cellIdx(r, c);
			const cell = maze.cells[idx];

			const left = (x1 + cellWidth * c) | 0;
			const right = (x1 + cellWidth * (c + 1)) | 0;
			const top = (y1 + cellHeight * r) | 0;
			const bottom = (y1 + cellHeight * (r + 1)) | 0;
			ctx.beginPath();
			ctx.moveTo(left, top);
			if ((cell & CONNECT_TOP) === 0) {
				ctx.lineTo(right, top);
			} else {
				ctx.moveTo(right, top);
			}
			if ((cell & CONNECT_RIGHT) === 0) {
				ctx.lineTo(right, bottom);
			} else {
				ctx.moveTo(right, bottom);
			}
			if ((cell & CONNECT_BOTTOM) === 0) {
				ctx.lineTo(left, bottom);
			} else {
				ctx.moveTo(left, bottom);
			}
			if ((cell & CONNECT_LEFT) === 0) {
				ctx.lineTo(left, top);
			} else {
				ctx.moveTo(left, top);
			}
			ctx.stroke();
		}
	}
}

export function setupMaze(canvas: HTMLCanvasElement): void {
	const ctx = canvas.getContext('2d');
	ctx.lineWidth = 1;
	ctx.strokeStyle = '#333';
	const maze = generateMaze(128, 64);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	drawMaze(maze, ctx, 10, 10, 1190, 590);
}

export function setupMazeRegen(button: HTMLButtonElement, canvas: HTMLCanvasElement): void {
	button.addEventListener('click', () => {
		setupMaze(canvas);
	});
}

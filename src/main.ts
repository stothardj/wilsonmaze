import './style.css'
import { setupMaze, setupMazeRegen } from './maze.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Maze</h1>
    <button id="regen">Regen Maze</button>
    <div class="card">
      <canvas id="game" width="1200" height="600"></canvas>
    </div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
setupMaze(canvas);
setupMazeRegen(document.querySelector<HTMLButtonElement>('#regen')!, canvas);

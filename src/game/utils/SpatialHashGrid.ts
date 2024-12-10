export class SpatialHashGrid<T extends { x: number; y: number }> {
  private cellSize: number
  private cells: Map<string, Set<T>> = new Map()

  constructor(cellSize: number) {
    this.cellSize = cellSize
  }

  private cellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize)
    const cellY = Math.floor(y / this.cellSize)
    return `${cellX},${cellY}`
  }

  public insert(obj: T): void {
    const key = this.cellKey(obj.x, obj.y)
    let cell = this.cells.get(key)
    if (!cell) {
      cell = new Set<T>()
      this.cells.set(key, cell)
    }
    cell.add(obj)
  }

  public remove(obj: T): void {
    const key = this.cellKey(obj.x, obj.y)
    const cell = this.cells.get(key)
    if (cell) {
      cell.delete(obj)
      if (cell.size === 0) {
        this.cells.delete(key)
      }
    }
  }

  public update(obj: T, oldX: number, oldY: number): void {
    const oldKey = this.cellKey(oldX, oldY)
    const newKey = this.cellKey(obj.x, obj.y)
    if (oldKey !== newKey) {
      this.removeFromCell(obj, oldKey)
      this.insert(obj)
    }
  }

  private removeFromCell(obj: T, key: string): void {
    const cell = this.cells.get(key)
    if (cell) {
      cell.delete(obj)
      if (cell.size === 0) {
        this.cells.delete(key)
      }
    }
  }

  public queryLine(line: Phaser.Geom.Line): Set<T> {
    const startCellX = Math.floor(Math.min(line.x1, line.x2) / this.cellSize)
    const startCellY = Math.floor(Math.min(line.y1, line.y2) / this.cellSize)
    const endCellX = Math.floor(Math.max(line.x1, line.x2) / this.cellSize)
    const endCellY = Math.floor(Math.max(line.y1, line.y2) / this.cellSize)

    const result = new Set<T>()

    for (let i = startCellX; i <= endCellX; i++) {
      for (let j = startCellY; j <= endCellY; j++) {
        const key = `${i},${j}`
        const cell = this.cells.get(key)
        if (cell) {
          for (const obj of cell) {
            result.add(obj)
          }
        }
      }
    }

    return result
  }
}

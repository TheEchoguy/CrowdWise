import { Vector2D } from '../types';
import { distance } from './geometry';

export interface NavNode {
  id: string;
  position: Vector2D;
  zoneId?: string;
  gateId?: string;
  isExit?: boolean;
}

export interface NavEdge {
  from: string;
  to: string;
  distance: number;
  width: number;
  corridorId?: string;
  isBlocked?: boolean;
}

export class NavigationGraph {
  public nodes: Map<string, NavNode> = new Map();
  public edges: Map<string, NavEdge[]> = new Map();

  public addNode(node: NavNode): void {
    this.nodes.set(node.id, node);
    if (!this.edges.has(node.id)) {
      this.edges.set(node.id, []);
    }
  }

  public addEdge(fromId: string, toId: string, width: number = 4.0, corridorId?: string, bidirectional: boolean = true): void {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);
    if (!fromNode || !toNode) return;

    const d = distance(fromNode.position, toNode.position);

    const forwardEdge: NavEdge = {
      from: fromId,
      to: toId,
      distance: d,
      width,
      corridorId,
      isBlocked: false,
    };
    this.edges.get(fromId)!.push(forwardEdge);

    if (bidirectional) {
      const backwardEdge: NavEdge = {
        from: toId,
        to: fromId,
        distance: d,
        width,
        corridorId,
        isBlocked: false,
      };
      this.edges.get(toId)!.push(backwardEdge);
    }
  }

  public setEdgeBlocked(corridorId: string, blocked: boolean): void {
    for (const edgeList of this.edges.values()) {
      for (const edge of edgeList) {
        if (edge.corridorId === corridorId) {
          edge.isBlocked = blocked;
        }
      }
    }
  }

  public findNearestNode(point: Vector2D, filter?: (node: NavNode) => boolean): NavNode | null {
    let bestNode: NavNode | null = null;
    let bestDistSq = Infinity;

    for (const node of this.nodes.values()) {
      if (filter && !filter(node)) continue;
      const dx = node.position.x - point.x;
      const dy = node.position.y - point.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestNode = node;
      }
    }
    return bestNode;
  }

  public findPath(
    startPos: Vector2D,
    targetPos: Vector2D,
    congestionPenalties?: Map<string, number>
  ): Vector2D[] {
    const startNode = this.findNearestNode(startPos);
    const targetNode = this.findNearestNode(targetPos);

    if (!startNode || !targetNode) {
      return [targetPos];
    }

    if (startNode.id === targetNode.id) {
      return [startNode.position, targetPos];
    }

    // A* Pathfinding
    const openSet: Set<string> = new Set([startNode.id]);
    const cameFrom: Map<string, string> = new Map();

    const gScore: Map<string, number> = new Map();
    gScore.set(startNode.id, 0);

    const fScore: Map<string, number> = new Map();
    fScore.set(startNode.id, distance(startNode.position, targetNode.position));

    while (openSet.size > 0) {
      // Find node in openSet with lowest fScore
      let currentId: string | null = null;
      let lowestF = Infinity;
      for (const id of openSet) {
        const score = fScore.get(id) ?? Infinity;
        if (score < lowestF) {
          lowestF = score;
          currentId = id;
        }
      }

      if (!currentId) break;
      if (currentId === targetNode.id) {
        // Reconstruct path
        const path: Vector2D[] = [targetPos];
        let curr = targetNode.id;
        while (cameFrom.has(curr)) {
          const node = this.nodes.get(curr);
          if (node) path.unshift(node.position);
          curr = cameFrom.get(curr)!;
        }
        const first = this.nodes.get(startNode.id);
        if (first) path.unshift(first.position);
        return path;
      }

      openSet.delete(currentId);
      const currentNode = this.nodes.get(currentId)!;
      const neighbors = this.edges.get(currentId) || [];

      for (const edge of neighbors) {
        if (edge.isBlocked) continue;

        const neighborNode = this.nodes.get(edge.to);
        if (!neighborNode) continue;

        // Apply congestion penalty if neighbor's zone is crowded
        let penalty = 1.0;
        if (congestionPenalties && neighborNode.zoneId) {
          const mult = congestionPenalties.get(neighborNode.zoneId) ?? 1.0;
          penalty = mult;
        }

        const tentativeG = (gScore.get(currentId) ?? Infinity) + edge.distance * penalty;

        if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
          cameFrom.set(edge.to, currentId);
          gScore.set(edge.to, tentativeG);
          const h = distance(neighborNode.position, targetNode.position);
          fScore.set(edge.to, tentativeG + h);
          openSet.add(edge.to);
        }
      }
    }

    // Direct fallback if no path found
    return [targetPos];
  }
}


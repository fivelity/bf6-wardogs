/**
 * Representing a 2D horizontal plane coordinate (East-West as X, North-South as Z).
 * Battlefield 6 Portal maps height to Y, which is ignored for 2D polygonal boundary checks.
 */
export interface Point2D {
    x: number;
    z: number;
}

/**
 * Custom type definition for a Boundary Segment.
 */
export interface Segment2D {
    p1: Point2D;
    p2: Point2D;
}

/**
 * Geometric pipeline for managing a dynamically drifting HotZone inside a custom 
 * Godot-defined ControlZone polygon. Includes ray-casting PIP, segment projection, 
 * edge-clamping, and centroid-drift vector generation.
 */
export class ZoneMath {
    /**
     * Converts a native Frostbite opaque vector to a plain Point2D horizontal coordinate.
     * Uses direct property access on mod.Vector.
     */
    public static toPoint2D(vector: mod.Vector): Point2D {
        return { x: vector.x, z: vector.z };
    }

    /**
     * Converts a Point2D coordinate back into an opaque Frostbite mod.Vector, 
     * preserving the target altitude (Y).
     */
    public static toModVector(point: Point2D, altitude: number): mod.Vector {
        return mod.CreateVector(point.x, altitude, point.z);
    }

    /**
     * Point-in-Polygon (PIP) Ray-Casting algorithm.
     * Evaluates the Jordan Curve Theorem on the horizontal (X, Z) plane.
     * 
     * @param point The test coordinate (e.g., drifting HotZone position).
     * @param vertices The vertices of the bounding polygon (e.g., ControlZone points).
     * @returns True if the point is strictly inside the polygonal region.
     */
    public static isPointInPolygon(point: Point2D, vertices: Point2D[]): boolean {
        if (vertices.length < 3) return false;

        let inside = false;
        const count = vertices.length;

        for (let i = 0, j = count - 1; i < count; j = i++) {
            const xi = vertices[i].x;
            const zi = vertices[i].z;
            const xj = vertices[j].x;
            const zj = vertices[j].z;

            // Determine if ray intersected segment p1-p2
            const intersect = ((zi > point.z) !== (zj > point.z)) &&
                (point.x < ((xj - xi) * (point.z - zi)) / (zj - zi + 1e-9) + xi); // Added small epsilon to prevent NaN division

            if (intersect) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Calculates the geometric centroid (center of mass) of a non-self-intersecting polygon.
     */
    public static calculateCentroid(vertices: Point2D[]): Point2D {
        let x = 0;
        let z = 0;
        let area = 0;
        const count = vertices.length;

        for (let i = 0; i < count; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % count];

            const factor = (p1.x * p2.z - p2.x * p1.z);
            x += (p1.x + p2.x) * factor;
            z += (p1.z + p2.z) * factor;
            area += factor;
        }

        area *= 0.5;
        const factor = 1.0 / (6.0 * area + 1e-9);

        return {
            x: x * factor,
            z: z * factor
        };
    }

    /**
     * Projects a 2D point onto an infinite line segment defined by two points.
     * Clamps the projection strictly to the segment boundaries (0 to 1).
     */
    public static projectPointToSegment(point: Point2D, segment: Segment2D): Point2D {
        const abX = segment.p2.x - segment.p1.x;
        const abZ = segment.p2.z - segment.p1.z;
        const apX = point.x - segment.p1.x;
        const apZ = point.z - segment.p1.z;

        const abLenSq = abX * abX + abZ * abZ;
        if (abLenSq === 0) return segment.p1;

        // Calculate projection factor t, clamped to segment boundaries [0, 1]
        let t = (apX * abX + apZ * abZ) / abLenSq;
        t = Math.max(0, Math.min(1, t));

        return {
            x: segment.p1.x + t * abX,
            z: segment.p1.z + t * abZ
        };
    }

    /**
     * Finds the nearest boundary coordinate on the polygon perimeter to a given point.
     */
    public static getClosestBoundaryPoint(point: Point2D, vertices: Point2D[]): Point2D {
        let minDistance = Infinity;
        let closestPoint: Point2D = vertices[0];
        const count = vertices.length;

        for (let i = 0; i < count; i++) {
            const segment: Segment2D = {
                p1: vertices[i],
                p2: vertices[(i + 1) % count]
            };

            const projected = this.projectPointToSegment(point, segment);
            const distSq = this.distanceSquared(point, projected);

            if (distSq < minDistance) {
                minDistance = distSq;
                closestPoint = projected;
            }
        }

        return closestPoint;
    }

    /**
     * Moves a boundary point slightly inward towards the polygon's centroid.
     * Prevents decimal rounding errors from triggering false out-of-bounds states.
     * 
     * @param boundaryPoint Point located on the perimeter.
     * @param centroid Centroid of the polygon.
     * @param offset Distance in meters to pull the point inward. Default 0.5m.
     */
    public static pullInward(boundaryPoint: Point2D, centroid: Point2D, offset: number = 0.5): Point2D {
        const dx = centroid.x - boundaryPoint.x;
        const dz = centroid.z - boundaryPoint.z;
        const len = Math.sqrt(dx * dx + dz * dz) + 1e-9;

        return {
            x: boundaryPoint.x + (dx / len) * offset,
            z: boundaryPoint.z + (dz / len) * offset
        };
    }

    /**
     * Main geometric handler to compute the next valid drifting step of the HotZone.
     * Employs random walk math heavily weighted towards the polygon centroid,
     * fallback to bounding limits, and instantaneous ray-cast clipping to enforce containment.
     * 
     * @param currentPos The current position of the HotZone.
     * @param vertices Bounding polygon points of the ControlZone.
     * @param stepSize The maximum step distance (in meters) the zone can travel per update.
     * @param pullFactor Percentage [0, 1] weight pulling the drift towards the centroid (reduces out-of-bounds iterations).
     */
    public static calculateNextDrift(
        currentPos: Point2D,
        vertices: Point2D[],
        stepSize: number,
        pullFactor: number = 0.15
    ): Point2D {
        if (vertices.length < 3) return currentPos;

        const centroid = this.calculateCentroid(vertices);

        // Step 1: Check if current position is already out-of-bounds. Correct instantly.
        if (!this.isPointInPolygon(currentPos, vertices)) {
            const boundary = this.getClosestBoundaryPoint(currentPos, vertices);
            return this.pullInward(boundary, centroid, 1.0); // Pull 1m inward
        }

        // Step 2: Formulate random walk step vector
        const angle = Math.random() * 2 * Math.PI;
        let stepX = Math.cos(angle) * stepSize;
        let stepZ = Math.sin(angle) * stepSize;

        // Step 3: Apply pull factor towards polygon centroid (gravitational walk)
        const toCentroidX = centroid.x - currentPos.x;
        const toCentroidZ = centroid.z - currentPos.z;
        const distToCentroid = Math.sqrt(toCentroidX * toCentroidX + toCentroidZ * toCentroidZ) + 1e-9;

        stepX = stepX * (1 - pullFactor) + (toCentroidX / distToCentroid) * stepSize * pullFactor;
        stepZ = stepZ * (1 - pullFactor) + (toCentroidZ / distToCentroid) * stepSize * pullFactor;

        const nextPoint: Point2D = {
            x: currentPos.x + stepX,
            z: currentPos.z + stepZ
        };

        // Step 4: Safety gate test. If valid, return step. If invalid, clamp step strictly to edge.
        if (this.isPointInPolygon(nextPoint, vertices)) {
            return nextPoint;
        }

        // Clip the out-of-bounds step to the nearest boundary edge and pull back inward
        const boundaryPoint = this.getClosestBoundaryPoint(nextPoint, vertices);
        return this.pullInward(boundaryPoint, centroid, 0.75);
    }

    private static distanceSquared(p1: Point2D, p2: Point2D): number {
        const dx = p1.x - p2.x;
        const dz = p1.z - p2.z;
        return dx * dx + dz * dz;
    }

    /**
     * Computes an inward-offset (shrunk) polygon by a given distance.
     * Shifts each edge toward the polygon's centroid and computes the intersection
     * of consecutive shifted edges to form the new vertex set.
     * 
     * @param vertices The original polygon vertices.
     * @param offset The distance (in meters) to shrink the polygon inward.
     * @returns The shrunk polygon vertices, or an empty array if the polygon collapses.
     */
    public static shrinkPolygon(vertices: Point2D[], offset: number): Point2D[] {
        if (vertices.length < 3) return [];
        
        const centroid = this.calculateCentroid(vertices);
        
        // Compute shifted edge lines (each line: nx * x + nz * z = c)
        interface ShiftedLine {
            nx: number;
            nz: number;
            c: number;
        }
        
        const lines: ShiftedLine[] = [];
        
        for (let i = 0; i < vertices.length; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % vertices.length];
            
            const dx = p2.x - p1.x;
            const dz = p2.z - p1.z;
            const len = Math.sqrt(dx * dx + dz * dz) + 1e-9;
            
            // Left normal (perpendicular, 90° CCW from edge direction)
            let nx = -dz / len;
            let nz = dx / len;
            
            // Ensure normal points inward (toward centroid)
            const midX = (p1.x + p2.x) / 2;
            const midZ = (p1.z + p2.z) / 2;
            const toCentroidX = centroid.x - midX;
            const toCentroidZ = centroid.z - midZ;
            const dot = nx * toCentroidX + nz * toCentroidZ;
            
            if (dot < 0) {
                nx = -nx;
                nz = -nz;
            }
            
            // Shift line inward by offset
            const c = nx * p1.x + nz * p1.z + offset;
            
            lines.push({ nx, nz, c });
        }
        
        // Compute intersections of consecutive shifted lines
        const result: Point2D[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const a = lines[i];
            const b = lines[(i + 1) % lines.length];
            
            const det = a.nx * b.nz - a.nz * b.nx;
            if (Math.abs(det) < 1e-9) continue; // Parallel edges
            
            const x = (a.c * b.nz - b.c * a.nz) / det;
            const z = (b.c * a.nx - a.c * b.nx) / det;
            
            result.push({ x, z });
        }
        
        return result;
    }
}

// src/riskUtils.ts
export function getRiskColor(riskLevel: string): string {
    switch (riskLevel) {
        case 'High':
            return 'rgba(255, 0, 0, 0.5)'; // Red with some transparency
        case 'Medium':
            return 'rgba(255, 255, 0, 0.5)'; // Yellow with some transparency
        case 'Low':
            return 'rgba(0, 255, 0, 0.5)'; // Green with some transparency
        default:
            return 'rgba(0, 0, 0, 0)'; // Transparent
    }
}
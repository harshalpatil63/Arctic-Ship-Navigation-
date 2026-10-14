import { jsPDF } from 'jspdf';
import { Route } from '../types';

function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  return parts.join(' ') || '0m';
}

export function generateRoutePDF(routes: Route[], selectedRoute: Route | null): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210; // A4 width in mm
  const margin = 18;
  const contentW = W - margin * 2;
  let y = 0;

  // ─── Color Palette ───────────────────────────────────────────────
  const DARK_BG  = [2, 6, 23]   as [number, number, number];   // #020617
  const CYAN     = [56, 189, 248] as [number, number, number]; // cyan-400
  const WHITE    = [255, 255, 255] as [number, number, number];
  const LIGHT    = [148, 163, 184] as [number, number, number]; // slate-400
  const ACCENT   = [99, 102, 241] as [number, number, number];  // indigo
  const SUCCESS  = [52, 211, 153] as [number, number, number];  // emerald
  const WARNING  = [251, 191, 36] as [number, number, number];  // amber
  const DANGER   = [239, 68, 68]  as [number, number, number];  // red

  function riskColor(level: string): [number, number, number] {
    if (level === 'High' || level === 'Critical') return DANGER;
    if (level === 'Medium') return WARNING;
    return SUCCESS;
  }

  // ─── Header Banner ───────────────────────────────────────────────
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, W, 42, 'F');

  // Gradient accent strip
  doc.setFillColor(...CYAN);
  doc.rect(0, 0, W, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...CYAN);
  doc.text('ARCTIC SHIP NAVIGATION', margin, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...LIGHT);
  doc.text('Route Analysis & Voyage Report', margin, 24);

  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`, margin, 31);
  doc.text(`Report ID: RPT-${Date.now().toString(36).toUpperCase()}`, margin, 37);

  // Logo box on right
  doc.setFillColor(...CYAN);
  doc.roundedRect(W - margin - 35, 8, 35, 22, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK_BG);
  doc.text('GEBCO MARINE', W - margin - 32, 16);
  doc.text('ROUTING', W - margin - 32, 22);
  doc.setFontSize(6);
  doc.text('Water-Only Validated', W - margin - 32, 28);

  y = 50;

  // ─── Summary Banner ──────────────────────────────────────────────
  if (selectedRoute) {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(margin, y, contentW, 32, 3, 3, 'F');
    doc.setDrawColor(...CYAN);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentW, 32, 3, 3, 'S');

    const dep = selectedRoute.departure?.name || 'Unknown';
    const arr = selectedRoute.arrival?.name || 'Unknown';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...WHITE);
    doc.text(`${dep}  →  ${arr}`, margin + 6, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...LIGHT);
    doc.text(`${selectedRoute.departure?.country || ''}`, margin + 6, y + 17);

    // Quick stats row
    const stats = [
      { label: 'Distance', value: `${Math.round(selectedRoute.distance)} km` },
      { label: 'ETA', value: formatDuration(selectedRoute.estimatedTimeMinutes) },
      { label: 'Fuel', value: `${selectedRoute.fuelEstimate ?? '—'} t` },
      { label: 'Risk', value: selectedRoute.riskLevel || 'N/A' },
    ];
    const cellW = contentW / stats.length;
    stats.forEach((stat, i) => {
      const x = margin + i * cellW + 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...LIGHT);
      doc.text(stat.label.toUpperCase(), x, y + 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      if (stat.label === 'Risk') {
        doc.setTextColor(...riskColor(stat.value));
      } else {
        doc.setTextColor(...CYAN);
      }
      doc.text(stat.value, x, y + 28);
    });

    y += 40;
  }

  // ─── Section: All Route Options ──────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.setFillColor(...DARK_BG);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setDrawColor(...CYAN);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 8, margin + contentW, y + 8);
  doc.text('ROUTE OPTIONS', margin + 4, y + 5.5);
  y += 14;

  routes.forEach((route, idx) => {
    const isSelected = selectedRoute?.id === route.id;
    const rowH = 28;

    // Card background
    if (isSelected) {
      doc.setFillColor(14, 30, 50);
    } else {
      doc.setFillColor(15, 23, 42);
    }
    doc.roundedRect(margin, y, contentW, rowH, 2, 2, 'F');

    if (isSelected) {
      doc.setDrawColor(...CYAN);
      doc.setLineWidth(0.5);
    } else {
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.2);
    }
    doc.roundedRect(margin, y, contentW, rowH, 2, 2, 'S');

    // Color dot
    const strategyColors: Record<string, [number, number, number]> = {
      optimal:   CYAN,
      safest:    SUCCESS,
      'fuel-efficient': WARNING,
      shortest:  ACCENT,
    };
    const dotColor = strategyColors[route.strategy || 'optimal'] || LIGHT;
    doc.setFillColor(...dotColor);
    doc.circle(margin + 6, y + 7, 2, 'F');

    // Route title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text(`${idx + 1}. ${route.label || `Route ${idx + 1}`}${isSelected ? '  ★ SELECTED' : ''}`, margin + 11, y + 8);

    // Strategy badge
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...dotColor);
    doc.text((route.strategy || 'optimal').toUpperCase(), margin + 11, y + 13);

    // Stats grid
    const routeStats = [
      `${Math.round(route.distance)} km`,
      formatDuration(route.estimatedTimeMinutes),
      `${route.fuelEstimate ?? '—'} t fuel`,
      `Risk: ${route.riskLevel}`,
    ];
    routeStats.forEach((stat, si) => {
      const sx = margin + 11 + si * (contentW / 4.5);
      doc.setFont('helvetica', si === 3 ? 'bold' : 'normal');
      doc.setFontSize(8);
      if (si === 3) {
        doc.setTextColor(...riskColor(route.riskLevel));
      } else {
        doc.setTextColor(...LIGHT);
      }
      doc.text(stat, sx, y + 21);
    });

    // Water-only badge
    if (route.validation?.waterOnly) {
      doc.setFillColor(6, 78, 59);
      doc.roundedRect(margin + contentW - 35, y + 18, 33, 5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...SUCCESS);
      doc.text('✓ WATER-ONLY VALIDATED', margin + contentW - 34, y + 22);
    }

    y += rowH + 3;

    // Check for page overflow
    if (y > 250) {
      doc.addPage();
      doc.setFillColor(...DARK_BG);
      doc.rect(0, 0, W, 297, 'F');
      doc.setFillColor(...CYAN);
      doc.rect(0, 0, W, 2, 'F');
      y = 15;
    }
  });

  y += 6;

  // ─── Weather Section ─────────────────────────────────────────────
  if (selectedRoute?.weatherConditions) {
    if (y > 210) {
      doc.addPage();
      doc.setFillColor(...DARK_BG);
      doc.rect(0, 0, W, 297, 'F');
      doc.setFillColor(...CYAN);
      doc.rect(0, 0, W, 2, 'F');
      y = 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.setFillColor(...DARK_BG);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setDrawColor(...CYAN);
    doc.line(margin, y + 8, margin + contentW, y + 8);
    doc.text('WEATHER & CONDITIONS', margin + 4, y + 5.5);
    y += 14;

    const wc = selectedRoute.weatherConditions;
    const weatherItems = [
      { label: 'Temperature', value: `${wc.temperature?.toFixed(1) ?? '—'}°C`, color: wc.temperature < -10 ? CYAN : wc.temperature < 0 ? SUCCESS : WARNING },
      { label: 'Wind Speed', value: `${wc.windSpeed?.toFixed(1) ?? '—'} km/h`, color: wc.windSpeed > 50 ? DANGER : wc.windSpeed > 30 ? WARNING : SUCCESS },
      { label: 'Wave Height', value: `${wc.waveHeight?.toFixed(1) ?? '—'} m`, color: wc.waveHeight > 4 ? DANGER : wc.waveHeight > 2 ? WARNING : SUCCESS },
      { label: 'Visibility', value: wc.visibility || 'Good', color: SUCCESS },
      { label: 'Sea Ice', value: `${wc.seaIceConcentration ?? 0}%`, color: wc.seaIceConcentration > 50 ? DANGER : SUCCESS },
      { label: 'Forecast', value: wc.forecast || 'N/A', color: LIGHT },
    ];

    const colW = contentW / 3;
    weatherItems.forEach((item, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const wx = margin + col * colW;
      const wy = y + row * 20;

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(wx + 1, wy, colW - 2, 17, 2, 2, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...LIGHT);
      doc.text(item.label.toUpperCase(), wx + 5, wy + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...item.color);
      doc.text(item.value, wx + 5, wy + 13);
    });
    y += Math.ceil(weatherItems.length / 3) * 20 + 8;
  }

  // ─── Footer ──────────────────────────────────────────────────────
  const docRecord = doc as unknown as { getNumberOfPages?: () => number; internal?: { getNumberOfPages?: () => number } };
  const totalPages = typeof docRecord.getNumberOfPages === 'function'
    ? docRecord.getNumberOfPages()
    : docRecord.internal?.getNumberOfPages?.() || 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...DARK_BG);
    doc.rect(0, 285, W, 12, 'F');
    doc.setFillColor(...CYAN);
    doc.rect(0, 285, W, 0.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT);
    doc.text('Arctic Ship Navigation System  ·  GEBCO Marine Routing  ·  Water-Only Validated Routes', margin, 291);
    doc.text(`Page ${p} of ${totalPages}`, W - margin - 20, 291);
  }

  // ─── Save ────────────────────────────────────────────────────────
  const dep = selectedRoute?.departure?.name || routes[0]?.departure?.name || 'Route';
  const arr = selectedRoute?.arrival?.name || routes[0]?.arrival?.name || 'Report';
  const filename = `Arctic-Route-Report_${dep.replace(/\s+/g, '-')}_to_${arr.replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

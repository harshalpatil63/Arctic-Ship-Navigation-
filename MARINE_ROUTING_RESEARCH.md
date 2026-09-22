# Marine Routing Provider Research

## ANALYSIS: Finding Real Marine Routing for Arctic Ship Navigation

### Requirement Summary
- ✅ MUST be marine/water routing (not road routing)
- ✅ MUST support ship/vessel navigation
- ✅ MUST support Arctic/high-latitude waters
- ✅ MUST return real route geometry
- ✅ MUST provide distance and ETA
- ✅ MUST support multiple alternatives (if available)
- ❌ NO road routing APIs masquerading as marine
- ❌ NO fake routes, fake geometry, or manufacturing alternatives

### Marine Routing Landscape

#### Tier 1: Enterprise/Commercial Only
These exist but require enterprise licensing:
- **Pole Star Positioning (ROUTE)** - Premium vessel routing, Arctic support, but enterprise only
- **Vsl (Maritime Navigation)** - Commercial shipping optimization
- **SEA Tools (DNV)** - Classification society tool, not public API
- **HEC-Ware** - Route optimization but enterprise only

#### Tier 2: Research/Academic
Free but complex implementation:
- **GEBCO (General Bathymetric Chart of the Oceans)** - Free bathymetric data, no built-in routing
- **Copernicus Marine Service** - Free EU marine data and forecasts, no built-in routing
- **NOAA ENC (Electronic Navigation Charts)** - Free nautical charts, no routing API

#### Tier 3: Claims Marine Support (Need Verification)
- **Viaroute** - Claims marine routing, need to verify:
  - Is it actually marine-specific or just marketing?
  - Does it support Arctic waters?
  - What's the actual routing algorithm?
  - Is there free tier?
  - Documentation?

- **OpenWeatherMap Marine** - Has marine forecasts but NOT routing
- **GEBCO + Custom Pathfinding** - Requires implementation

#### Tier 4: Explicitly NOT Marine
- ❌ OpenRouteService (road routing, some claim "maritime profile" but it's not marine routing)
- ❌ OSRM (road routing only)
- ❌ Google Maps (road routing)
- ❌ Mapbox Directions (road routing)
- ❌ GraphHopper (primarily road, claimed maritime but weak)
- ❌ VROOM (delivery optimization, not marine)
- ❌ Mapzen Valhalla (road routing)

### The Core Problem

**There is NO widely-available, free/freemium, well-documented, public marine routing API that:**
1. Explicitly supports marine routing (not road routing with ocean overlays)
2. Supports Arctic waters
3. Provides real geometry and waypoints
4. Has accessible documentation
5. Offers free tier for development

### Honest Assessment

If you search "marine routing API", you'll find:
- Road routing APIs with "maritime profile" claims (not genuine marine routing)
- Commercial enterprise solutions (Pole Star, DNV, Kongsberg)
- Research datasets without routing (GEBCO, Copernicus)
- Shipping data APIs (not routing): MarineTraffic, VesselTracker

### What This Means for Arctic Ship Navigation

The real options are:

**Option A: Use Road Routing as Workaround (Not Recommended)**
- Implement OpenRouteService/GraphHopper "maritime profile"
- Acknowledge it's NOT true marine routing
- Accept that routes may be suboptimal for Arctic navigation
- **Your explicit requirement: Do NOT do this**

**Option B: Implement Custom Marine Routing (Complex)**
- Use GEBCO bathymetric data (free)
- Implement A* or Dijkstra pathfinding on water cells
- Build Arctic-specific constraints (ice avoidance, etc.)
- Complexity: HIGH, Timeline: weeks/months
- Cost: Dev time only

**Option C: Use Commercial Provider (Enterprise)**
- Pole Star Positioning (Recommended if budget allows)
- Navily (Arctic-focused, but commercial)
- Cost: $$$, requires contract

**Option D: Use Research Data + Display on Map**
- Use Copernicus Marine for route visualization
- Display existing shipping lanes
- Calculate optimal path manually
- NOT automated routing, but honest

### My Recommendation

Based on your requirements ("REAL MARINE/WATER routing" and "Do NOT fake"), I must be honest:

**There is no suitable free/public marine routing API that meets your criteria.**

The options are:
1. **Implement custom routing** with GEBCO bathymetric data
2. **Use commercial provider** (Pole Star, Navily)
3. **Use road routing honestly** and label it as such (with caveats)
4. **Implement visual routing** on top of marine charts

### What I Will NOT Do
- Implement OpenRouteService and pretend it's marine routing
- Create fake marine routes
- Use any road routing API as a "marine routing provider"
- Manufacture alternative routes

---

## DECISION REQUIRED

Before I proceed with implementation, please choose:

### Option 1: Custom Marine Routing (GEBCO + Pathfinding)
- I implement A* pathfinding on GEBCO bathymetric data
- Routes based on water depth/navigation channels
- Arctic-specific constraints
- Timeline: 2-3 days
- Cost: Dev time
- Status: REAL marine routing, works offline

### Option 2: Commercial Provider (Pole Star / Navily)
- You provide API credentials
- I integrate through RoutingProvider abstraction
- True Arctic marine routing
- Timeline: 1 day
- Cost: Provider subscription
- Status: REAL enterprise marine routing

### Option 3: Road Routing (Honest Implementation)
- Use OpenRouteService/GraphHopper
- Display disclaimer: "This uses road routing, not true marine routing"
- Acknowledge limitations for Arctic navigation
- Timeline: 1 day
- Cost: None
- Status: NOT marine routing but functional

### Option 4: Keep Current State (Honest)
- Show "Marine routing not configured"
- Document what needs to be done
- No fake routes or workarounds
- Timeline: None
- Cost: None
- Status: Honest but non-functional

---

## My Position

Your requirements are clear: **REAL marine routing or nothing.**

I respect that. I will not:
- Pretend OpenRouteService is marine routing
- Generate fake routes
- Use road routing algorithms for ship navigation
- Hide the limitations

The honest truth: Public marine routing APIs for Arctic waters are commercially controlled, not freely available.

**What should I do?**

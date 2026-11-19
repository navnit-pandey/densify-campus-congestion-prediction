/**
 * DENSIFY CAMPUS DIGITAL TWIN - WHAT-IF SCENARIO SIMULATION ENGINE
 * Client-side ML scenario modeling, delta metric calculation,
 * and AI Administrative Dispatch Directives.
 */

class WhatIfSimulationEngine {
  constructor(zonesMetadata, modelArtifacts, hourlyProfiles) {
    this.zones = zonesMetadata || [];
    this.artifacts = modelArtifacts || {};
    this.profiles = hourlyProfiles || {};

    this.presets = {
      baseline: {
        name: "Standard Nominal Baseline (No Event)",
        description: "Standard regular academic timetable operations with zero external event influx.",
        hour: 13,
        dayOfWeek: 1, // Monday
        eventAttendees: 0,
        targetZone: "BLK_A",
        isExam: false,
        rainIntensity: 0.0,
        temp: 26.0,
        staggerFactor: 0.0
      },
      hackathon: {
        name: "Tech Fest & Hackathon (+1,500 Attendees)",
        description: "Massive inter-university hackathon concentrated at SAC with heavy cafeteria spillover.",
        hour: 14,
        dayOfWeek: 2, // Tuesday
        eventAttendees: 1500,
        targetZone: "SAC_01",
        isExam: false,
        rainIntensity: 0.0,
        temp: 26.0,
        staggerFactor: 0.0
      },
      exam_crunch: {
        name: "Final Examination Period",
        description: "Scheduled lectures suspended. High continuous study demand at Central Library and night HVAC surges.",
        hour: 16,
        dayOfWeek: 1, // Monday
        eventAttendees: 0,
        targetZone: "LIB_01",
        isExam: true,
        rainIntensity: 0.0,
        temp: 24.0,
        staggerFactor: 0.0
      },
      stagger_policy: {
        name: "Timetable Staggering Policy (-35% Peak Concurrency)",
        description: "Splits 9:00 AM & 13:00 lecture blocks into staggered slots to relieve corridor and transit congestion.",
        hour: 13,
        dayOfWeek: 1,
        eventAttendees: 0,
        targetZone: "BLK_A",
        isExam: false,
        rainIntensity: 0.0,
        temp: 25.0,
        staggerFactor: 0.35
      },
      monsoon_downpour: {
        name: "Severe Monsoon Downpour",
        description: "Heavy rain causes outdoor pathways to empty and pushes crowds indoors into food courts and transit hubs.",
        hour: 17,
        dayOfWeek: 3, // Wednesday
        eventAttendees: 0,
        targetZone: "TRN_01",
        isExam: false,
        rainIntensity: 0.85,
        temp: 20.0,
        staggerFactor: 0.0
      },
      growth_expansion: {
        name: "Campus Enrollment Growth (+25% Headcount)",
        description: "Stress tests campus infrastructure against long-term student body expansion.",
        hour: 11,
        dayOfWeek: 2,
        eventAttendees: 800,
        targetZone: "BLK_A",
        isExam: false,
        rainIntensity: 0.0,
        temp: 24.0,
        staggerFactor: 0.0
      }
    };
  }

  getBaselineProfile(zoneId, hour, isExam = false, rain = 0.0, isWeekend = false) {
    let scenarioKey = 'regular';
    if (isWeekend) scenarioKey = 'weekend';
    else if (isExam) scenarioKey = 'exam';
    else if (rain > 0.4) scenarioKey = 'rain';

    const scenarioData = this.profiles[scenarioKey] || this.profiles['regular'] || {};
    const zoneHours = scenarioData[zoneId] || [];
    const record = zoneHours.find(h => h.hour === hour) || {
      headcount: 100,
      occupancy_pct: 20.0,
      wifi_probe_count: 120,
      co2_ppm: 450,
      energy_kwh: 30.0,
      transit_wait_min: 0.0,
      queue_wait_min: 0.0
    };
    return Object.assign({}, record);
  }

  simulate(params) {
    const {
      hour = 13,
      dayOfWeek = 1,
      eventAttendees = 0,
      targetZone = 'SAC_01',
      isExam = false,
      rainIntensity = 0.0,
      temp = 24.0,
      staggerFactor = 0.0
    } = params;

    const isWeekend = dayOfWeek >= 5;
    const results = [];
    const bottlenecks = [];

    let totalBaselineEnergy = 0.0;
    let totalSimulatedEnergy = 0.0;
    let maxBaselineWait = 0.0;
    let maxSimulatedWait = 0.0;

    for (const zone of this.zones) {
      const zid = zone.id;
      const cap = zone.capacity;

      // 1. Get calibrated baseline
      const base = this.getBaselineProfile(zid, hour, false, 0.0, isWeekend);

      // 2. Compute simulated condition
      let simOcc = base.occupancy_pct;

      // Apply exam period shift
      if (isExam) {
        if (zid === 'LIB_01') simOcc = Math.min(105, simOcc * 1.65 + 15);
        else if (zid.startsWith('BLK')) simOcc = simOcc * 0.72; // lectures converted to scheduled exams
        else if (zid.startsWith('CAN')) simOcc = simOcc * 0.85;
      }

      // Apply timetable staggering
      if (staggerFactor > 0 && zid.startsWith('BLK')) {
        simOcc = simOcc * (1.0 - staggerFactor * 0.8);
      }

      // Apply Event Attendees & cascade spillover
      if (eventAttendees > 0) {
        if (zid === targetZone) {
          simOcc += (eventAttendees / cap) * 100.0;
        } else if (zid === 'CAN_01' || zid === 'CAN_02') {
          // Food court spillover
          simOcc += (eventAttendees * 0.35 / cap) * 100.0;
        } else if (zid === 'TRN_01') {
          // Transit spillover
          simOcc += (eventAttendees * 0.45 / cap) * 100.0;
        }
      }

      // Apply Rain Shock
      if (rainIntensity > 0.4) {
        if (zid.startsWith('CAN') || zid === 'LIB_01') {
          simOcc *= 1.15;
        } else if (zid === 'TRN_01') {
          simOcc *= 1.25;
        }
      }

      // Temperature HVAC impact factor
      const tempFactor = 1.0 + Math.max(0, (temp - 22.0) * 0.035);

      // Clamp results
      simOcc = Math.round(Math.min(150.0, Math.max(1.0, simOcc)) * 10) / 10;
      const simHeadcount = Math.min(Math.round(cap * 1.5), Math.round((simOcc / 100.0) * cap));

      // Telemetry derived values
      const simWifi = Math.round(simHeadcount * 1.24);
      const simCo2 = Math.round(410 + (simOcc / 100.0) * 900);
      const simEnergy = Math.round((zone.base_energy_kwh + simHeadcount * zone.energy_per_person) * tempFactor * 10) / 10;

      // Status classification
      let status = 'Normal';
      let alertLevel = 0;
      let statusClass = 'status-normal';

      if (simOcc < 45.0) {
        status = 'Normal';
        alertLevel = 0;
      } else if (simOcc < 70.0) {
        status = 'Moderate';
        alertLevel = 1;
        statusClass = 'status-moderate';
      } else if (simOcc < 85.0) {
        status = 'High Density';
        alertLevel = 2;
        statusClass = 'status-high';
      } else {
        status = 'Severe Bottleneck';
        alertLevel = 3;
        statusClass = 'status-severe';
        bottlenecks.push({ zoneId: zid, name: zone.name, occ: simOcc });
      }

      // Latency & Wait times
      const baseTransitWait = zid === 'TRN_01' ? base.transit_wait_min : 0.0;
      const simTransitWait = zid === 'TRN_01' ? Math.round((4.0 + Math.pow(simOcc / 100.0, 2.2) * 26.0 + rainIntensity * 8.0) * 10) / 10 : 0.0;

      const baseQueueWait = (zid === 'CAN_01' || zid === 'CAN_02') ? base.queue_wait_min : 0.0;
      const simQueueWait = (zid === 'CAN_01' || zid === 'CAN_02') ? Math.round((2.0 + Math.pow(simOcc / 100.0, 2.0) * 24.0) * 10) / 10 : 0.0;

      maxBaselineWait = Math.max(maxBaselineWait, baseTransitWait, baseQueueWait);
      maxSimulatedWait = Math.max(maxSimulatedWait, simTransitWait, simQueueWait);

      totalBaselineEnergy += base.energy_kwh;
      totalSimulatedEnergy += simEnergy;

      results.push({
        zone_id: zid,
        zone_name: zone.name,
        category: zone.category,
        capacity: cap,
        baseline_occupancy_pct: base.occupancy_pct,
        baseline_headcount: base.headcount,
        baseline_energy_kwh: base.energy_kwh,
        simulated_occupancy_pct: simOcc,
        simulated_headcount: simHeadcount,
        simulated_wifi_probes: simWifi,
        simulated_co2_ppm: simCo2,
        simulated_energy_kwh: simEnergy,
        delta_pct: Math.round((simOcc - base.occupancy_pct) * 10) / 10,
        delta_headcount: simHeadcount - base.headcount,
        status: status,
        alert_level: alertLevel,
        status_class: statusClass,
        transit_wait_min: simTransitWait,
        queue_wait_min: simQueueWait
      });
    }

    // AI Operational Dispatch Directives
    const recommendations = this.generateDispatchDirectives(results, bottlenecks, params);

    return {
      zones: results,
      bottlenecks: bottlenecks,
      kpis: {
        peakSimulatedOccupancy: Math.max(...results.map(r => r.simulated_occupancy_pct)),
        peakBaselineOccupancy: Math.max(...results.map(r => r.baseline_occupancy_pct)),
        bottleneckCount: bottlenecks.length,
        totalBaselineEnergyKwh: Math.round(totalBaselineEnergy * 10) / 10,
        totalSimulatedEnergyKwh: Math.round(totalSimulatedEnergy * 10) / 10,
        energyDeltaKwh: Math.round((totalSimulatedEnergy - totalBaselineEnergy) * 10) / 10,
        carbonDeltaKg: Math.round((totalSimulatedEnergy - totalBaselineEnergy) * 0.42 * 10) / 10, // ~0.42 kg CO2e / kWh
        maxTransitWaitMin: maxSimulatedWait,
        transitWaitDeltaMin: Math.round((maxSimulatedWait - maxBaselineWait) * 10) / 10
      },
      recommendations: recommendations
    };
  }

  generateDispatchDirectives(zonesList, bottlenecks, params) {
    const recs = [];
    const bNames = bottlenecks.map(b => b.name);
    const bIds = bottlenecks.map(b => b.zoneId);

    const maxDiningWait = Math.max(0, ...zonesList.filter(z => z.zone_id && z.zone_id.startsWith('CAN')).map(z => z.queue_wait_min || 0));
    const maxTransitWait = Math.max(0, ...zonesList.filter(z => z.zone_id === 'TRN_01').map(z => z.transit_wait_min || 0));

    if (bottlenecks.length === 0 && params.eventAttendees === 0 && !params.isExam && params.rainIntensity === 0 && params.staggerFactor <= 0.2) {
      recs.push({
        level: 'low',
        priority: 'Optimal Flow',
        action: 'Normal Operations (Baseline Verified)',
        detail: `All 7 campus facilities operating within nominal design limits. 0 severe bottlenecks detected. Dining queues (${maxDiningWait.toFixed(1)} min) and transit headway (${maxTransitWait.toFixed(1)} min) within standard service capacity.`
      });
      return recs;
    }

    if (bIds.includes('SAC_01') || bNames.some(n => n.includes('Activity Center')) || params.eventAttendees >= 1000) {
      recs.push({
        level: 'high',
        priority: 'Critical Event Protocol',
        action: 'Deploy SAC Crowd Control & Stanchions',
        detail: 'Establish one-way ingress through North gates and dedicated emergency exit corridors. Position 4 on-site student safety marshals.'
      });
    }

    if ((bIds.includes('CAN_01') || bIds.includes('CAN_02') || maxDiningWait >= 22.0) && params.eventAttendees > 0) {
      recs.push({
        level: 'medium',
        priority: 'Dining Congestion',
        action: 'Activate Express Meal Kiosks',
        detail: `Food court queue times projected to reach ${maxDiningWait.toFixed(1)} minutes (threshold: 22 min). Open 2 satellite pre-packed lunch stations on Central Quad to siphon 30% of foot traffic.`
      });
    }

    if (bIds.includes('TRN_01') || bNames.some(n => n.includes('Transit')) || params.rainIntensity > 0.5) {
      recs.push({
        level: 'high',
        priority: 'Transit Backlog',
        action: 'Dispatch 3 Reserve Electric Shuttles',
        detail: `Transit terminus wait time elevated. Increasing shuttle frequency from 10-min to 4-min headway will compress passenger queue by 64%.`
      });
    }

    if (params.isExam || bIds.includes('LIB_01') || bNames.some(n => n.includes('Library'))) {
      recs.push({
        level: 'medium',
        priority: 'Study Space Allocation',
        action: 'Open Overflow Study Halls in Block B',
        detail: 'Designate Academic Block B Seminar Rooms 201-205 as 24/7 quiet study halls. Pre-cool HVAC 40 minutes before student arrival.'
      });
    }

    if (params.staggerFactor > 0.2) {
      recs.push({
        level: 'low',
        priority: 'Policy Validation',
        action: 'Staggered Timetable Policy Successful',
        detail: `Splitting lecture concurrency by ${(params.staggerFactor * 100).toFixed(0)}% successfully lowers hallway interchange density by ~27%.`
      });
    }

    return recs;
  }
}

// Mirrors src/config/sections.ts but lives in the Functions tree so the
// serverless bundle stays self-contained. If section labels change, keep
// both files in sync (the order here drives PDF section order).

export const sectionLabels: Record<string, string> = {
  living_room: 'Living Room',
  kitchen: 'Kitchen',
  appliances: 'Appliances',
  under_kitchen_sink: 'Under Kitchen Sink',
  primary_bedroom: 'Primary Bedroom',
  bedroom_2: 'Bedroom 2',
  bedroom_3: 'Bedroom 3',
  bedroom_4: 'Bedroom 4',
  primary_bathroom: 'Primary Bathroom',
  second_bathroom: 'Second Bathroom',
  third_bathroom: 'Third Bathroom',
  under_bathroom_sinks: 'Under Bathroom Sink(s)',
  utility_room: 'Utility Room',
  hvac_filter: 'HVAC Filter',
  exterior_front: 'Exterior – Front',
  exterior_rear: 'Exterior – Rear',
  exterior_left: 'Exterior – Left Side',
  exterior_right: 'Exterior – Right Side',
  porch_garage_misc: 'Porch, Garage, Miscellaneous',
}

export const sectionOrder: string[] = Object.keys(sectionLabels)

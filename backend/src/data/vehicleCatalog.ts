/**
 * Offline fallback data for the make/model pickers.
 *
 * The live catalog comes from NHTSA vPIC (see services/vehicleCatalog.ts).
 * NHTSA is authoritative for current US-market cars and motorcycles, but a
 * hosted server can briefly lose outbound access, so the app always has a
 * useful built-in list and users can still type a value manually.
 *
 * Machine makes/models are intentionally local: vPIC only covers road
 * vehicles, and a curated list is more useful for workshop equipment.
 */

export const FALLBACK_CAR_MODELS: Record<string, string[]> = {
  Acura: ['Integra', 'MDX', 'RDX', 'TLX', 'ZDX'],
  Audi: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'RS3', 'RS6', 'TT'],
  BMW: ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series', 'i4', 'i5', 'i7', 'iX', 'M2', 'M3', 'M4', 'M5', 'X1', 'X2', 'X3', 'X5', 'X6', 'X7', 'XM', 'Z4'],
  Buick: ['Enclave', 'Encore GX', 'Envista', 'Envision'],
  Cadillac: ['CT4', 'CT5', 'Escalade', 'Lyriq', 'XT4', 'XT5', 'XT6'],
  Chevrolet: ['Blazer', 'Blazer EV', 'Bolt EUV', 'Bolt EV', 'Camaro', 'Colorado', 'Corvette', 'Equinox', 'Equinox EV', 'Malibu', 'Silverado 1500', 'Suburban', 'Tahoe', 'Trailblazer', 'Traverse', 'Trax'],
  Chrysler: ['300', 'Pacifica', 'Voyager'],
  Dodge: ['Challenger', 'Charger', 'Durango', 'Hornet'],
  Ford: ['Bronco', 'Bronco Sport', 'E-Transit', 'Edge', 'Escape', 'Expedition', 'Explorer', 'F-150', 'F-250', 'Maverick', 'Mustang', 'Mustang Mach-E', 'Ranger', 'Transit'],
  Genesis: ['Electrified G80', 'Electrified GV70', 'G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
  GMC: ['Acadia', 'Canyon', 'Hummer EV', 'Sierra 1500', 'Sierra 2500HD', 'Terrain', 'Yukon'],
  Honda: ['Accord', 'Civic', 'CR-V', 'HR-V', 'Odyssey', 'Passport', 'Pilot', 'Prologue', 'Ridgeline'],
  Hyundai: ['Elantra', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Palisade', 'Santa Cruz', 'Santa Fe', 'Sonata', 'Tucson', 'Venue'],
  Infiniti: ['Q50', 'QX50', 'QX55', 'QX60', 'QX80'],
  Jeep: ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Grand Wagoneer', 'Renegade', 'Wagoneer', 'Wrangler'],
  Kia: ['Carnival', 'EV6', 'EV9', 'Forte', 'K5', 'Niro', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Telluride'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  Lexus: ['ES', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'RZ', 'TX', 'UX'],
  Lincoln: ['Aviator', 'Corsair', 'Nautilus', 'Navigator'],
  Mazda: ['CX-30', 'CX-5', 'CX-50', 'CX-70', 'CX-90', 'Mazda3', 'Mazda6', 'MX-5 Miata', 'MX-30'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'CLA', 'CLE', 'E-Class', 'EQE', 'EQS', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'S-Class', 'SL', 'Sprinter'],
  Mini: ['Cooper', 'Countryman'],
  Mitsubishi: ['Eclipse Cross', 'Mirage', 'Outlander', 'Outlander PHEV', 'Outlander Sport'],
  Nissan: ['Altima', 'Ariya', 'Armada', 'Frontier', 'GT-R', 'Kicks', 'Leaf', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Versa', 'Z'],
  Polestar: ['Polestar 2', 'Polestar 3', 'Polestar 4'],
  Porsche: ['718 Boxster', '718 Cayman', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
  Ram: ['1500', '2500', '3500', 'ProMaster', 'ProMaster City'],
  Rivian: ['R1S', 'R1T', 'R2'],
  Subaru: ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Solterra', 'WRX'],
  Tesla: ['Cybertruck', 'Model 3', 'Model S', 'Model X', 'Model Y'],
  Toyota: ['4Runner', 'bZ4X', 'Camry', 'Corolla', 'Crown', 'Crown Signia', 'GR Corolla', 'GR86', 'GR Supra', 'Grand Highlander', 'Highlander', 'Land Cruiser', 'Mirai', 'Prius', 'RAV4', 'Sequoia', 'Sienna', 'Tacoma', 'Tundra'],
  Volkswagen: ['Arteon', 'Atlas', 'Atlas Cross Sport', 'Golf GTI', 'Golf R', 'ID.4', 'ID.Buzz', 'Jetta', 'Taos', 'Tiguan'],
  Volvo: ['C40', 'EX30', 'EX90', 'S60', 'S90', 'V60', 'XC40', 'XC60', 'XC90'],
};

export const FALLBACK_MOTORCYCLE_MODELS: Record<string, string[]> = {
  Aprilia: ['RS 660', 'RSV4', 'Shiver 900', 'Tuareg 660', 'Tuono 660', 'Tuono V4'],
  BMW: ['CE 04', 'F 850 GS', 'F 900 R', 'F 900 XR', 'G 310 GS', 'G 310 R', 'R 1250 GS', 'R 18', 'S 1000 RR', 'S 1000 XR'],
  Ducati: ['DesertX', 'Diavel V4', 'Hypermotard', 'Monster', 'Multistrada V2', 'Multistrada V4', 'Panigale V2', 'Panigale V4', 'Scrambler Icon', 'Streetfighter V4'],
  'Harley-Davidson': ['Fat Bob', 'Forty-Eight', 'Heritage Classic', 'Iron 883', 'LiveWire One', 'Low Rider S', 'Nightster', 'Pan America 1250', 'Road Glide', 'Road King', 'Softail Standard', 'Sportster S', 'Street Bob', 'Street Glide'],
  Honda: ['Africa Twin', 'CB500F', 'CB650R', 'CBR500R', 'CBR650R', 'CRF300L', 'Grom', 'Gold Wing', 'NC750X', 'Rebel 500', 'Rebel 1100', 'Trail 125', 'Transalp', 'XR650L'],
  Husqvarna: ['FE 501', 'Norden 901', 'Svartpilen 401', 'Vitpilen 401'],
  Indian: ['Chief', 'Chieftain', 'FTR', 'Roadmaster', 'Scout', 'Scout Bobber', 'Super Chief'],
  Kawasaki: ['KLR650', 'KLX300', 'Ninja 400', 'Ninja 500', 'Ninja 650', 'Ninja 1000SX', 'Ninja ZX-10R', 'Ninja ZX-4RR', 'Ninja ZX-6R', 'Versys 650', 'Versys 1000', 'Vulcan S', 'Z400', 'Z650', 'Z900', 'Z900RS'],
  KTM: ['1290 Super Adventure', '1290 Super Duke R', '390 Adventure', '390 Duke', '500 EXC-F', '690 Enduro R', '790 Adventure', '790 Duke', '890 Adventure', '890 Duke R'],
  'Moto Guzzi': ['V100 Mandello', 'V7', 'V85 TT'],
  'Royal Enfield': ['Bullet 350', 'Classic 350', 'Continental GT 650', 'Himalayan 450', 'Hunter 350', 'Interceptor 650', 'Meteor 350', 'Shotgun 650', 'Super Meteor 650'],
  Suzuki: ['Boulevard C50', 'DR650S', 'DR-Z400S', 'GSX-8R', 'GSX-8S', 'GSX-R1000', 'GSX-R600', 'GSX-R750', 'Hayabusa', 'SV650', 'V-Strom 650', 'V-Strom 800DE', 'V-Strom 1050'],
  Triumph: ['Bonneville T100', 'Bonneville T120', 'Rocket 3', 'Scrambler 1200', 'Speed Triple 1200', 'Speed Twin 1200', 'Speed Twin 900', 'Street Twin', 'Tiger 1200', 'Tiger 660', 'Tiger 900', 'Trident 660'],
  Yamaha: ['Bolt', 'MT-03', 'MT-07', 'MT-09', 'MT-10', 'Super Tenere', 'Tenere 700', 'Tracer 9 GT', 'TW200', 'V Star 250', 'XSR700', 'XSR900', 'YZF-R1', 'YZF-R3', 'YZF-R7'],
  Zero: ['DSR/X', 'FX', 'SR', 'SR/F', 'SR/S'],
};

export interface MachineCatalog {
  makes: string[];
  models: Record<string, string[]>;
}

export const MACHINE_CATALOG: Record<
  'drilling_machine' | 'milling_machine' | 'lifting_machine',
  MachineCatalog
> = {
  drilling_machine: {
    makes: [
      'Bosch',
      'Makita',
      'DeWalt',
      'Milwaukee',
      'JET',
      'Powermatic',
      'Grizzly',
      'RIKON',
      'Dake',
      'Baileigh',
      'Clausing',
      'Arboga',
    ],
    models: {
      Bosch: ['GBM 13 RE', 'GBM 1600 RE', 'GBH 2-26', 'GSB 550'],
      Makita: ['DP2010', 'DP400', 'HP1630', 'HP2070'],
      DeWalt: ['DCD996', 'DWD112', 'DWD115', 'DWD520'],
      Milwaukee: ['0234-6', '1107-6', '2504-20', '4204'],
      JET: ['JDP-12', 'JDP-15B', 'JDP-17', 'JDP-20VS'],
      Powermatic: ['PM2800B', 'PM2800VS'],
      Grizzly: ['G0795', 'G7943', 'G7944', 'G7948'],
      RIKON: ['30-120', '30-140', '30-160'],
      Dake: ['SB-25V', 'SB-32V'],
      Baileigh: ['DP-1500G', 'DP-1850G'],
      Clausing: ['2276', '2286'],
      Arboga: ['E100', 'E130', 'E830'],
    },
  },
  milling_machine: {
    makes: [
      'Haas',
      'DMG MORI',
      'Mazak',
      'Tormach',
      'Bridgeport',
      'JET',
      'Grizzly',
      'Sharp',
      'Lagun',
      'Baileigh',
      'Clausing',
    ],
    models: {
      Haas: ['CMX 600 V', 'Mini Mill', 'Super Mini Mill', 'TM-1', 'TM-2', 'UMC-500', 'VF-1', 'VF-2'],
      'DMG MORI': ['CMX 600 V', 'DMU 50', 'DMU 75 monoBLOCK', 'NHX 4000'],
      Mazak: ['QT-200', 'VC-500A', 'VCN-460', 'VCN-530C'],
      Tormach: ['1100MX', '24R', 'PCNC 1100', 'PCNC 440'],
      Bridgeport: ['Series I', 'Series II', 'VMC 1000', 'VMC 760'],
      JET: ['JTM-1', 'JTM-2', 'JTM-4VS', 'JTM-949EVS'],
      Grizzly: ['G0720R', 'G0730', 'G0731', 'G0755'],
      Sharp: ['LMV', 'SV-2412', 'TMV', 'TMV-1'],
      Lagun: ['FTV-1', 'FTV-2', 'FTV-3'],
      Baileigh: ['VM-1250E', 'VM-942E'],
      Clausing: ['8520', '8530', '8540'],
    },
  },
  lifting_machine: {
    makes: [
      'Toyota Material Handling',
      'Hyster',
      'Crown',
      'Yale',
      'Raymond',
      'Linde',
      'Jungheinrich',
      'Clark',
      'Doosan',
      'Genie',
      'JLG',
      'Skyjack',
    ],
    models: {
      'Toyota Material Handling': ['8FBE20', '8FGCU25', '8FGU25', '9FBM30'],
      Hyster: ['E50XN', 'H50FT', 'H60FT', 'J40XN'],
      Crown: ['FC 5200', 'RM 6000', 'SC 6000', 'WP 3000'],
      Yale: ['ERP040VF', 'GDP060VX', 'GLP050VX', 'MPB045VG'],
      Raymond: ['4250', '8210', '8410', '9800'],
      Linde: ['E30', 'H25D', 'L14', 'MT15'],
      Jungheinrich: ['AM 22', 'EFG 320', 'EJE 116', 'ETV 216'],
      Clark: ['C25', 'ESX20', 'GTS30', 'NPX20'],
      Doosan: ['B25S-7', 'BR20S-7', 'G25S-7'],
      Genie: ['GR-12', 'GS-1932', 'GS-2632', 'GTH-844'],
      JLG: ['1055', '1930ES', '2632ES', '450AJ'],
      Skyjack: ['SJ3219', 'SJ4626', 'SJ6832RT', 'SJ9250'],
    },
  },
};

export const CAR_FALLBACK_MAKES = Object.keys(FALLBACK_CAR_MODELS).sort((a, b) =>
  a.localeCompare(b)
);
export const MOTORCYCLE_FALLBACK_MAKES = Object.keys(FALLBACK_MOTORCYCLE_MODELS).sort((a, b) =>
  a.localeCompare(b)
);

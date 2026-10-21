import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Vehicle, VehiclePatch } from '../types';
import {
  createVehicle as apiCreateVehicle,
  deleteVehicle as apiDeleteVehicle,
  fetchVehicles,
  NewVehicleInput,
  updateVehicle as apiUpdateVehicle,
} from '../services/vehicleService';

interface VehicleStore {
  vehicles: Vehicle[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addVehicle: (vehicle: NewVehicleInput) => Promise<Vehicle>;
  editVehicle: (id: string, patch: VehiclePatch) => Promise<Vehicle>;
  removeVehicle: (id: string) => Promise<void>;
  getVehicle: (id: string) => Vehicle | undefined;
}

const VehicleContext = createContext<VehicleStore | undefined>(undefined);

export function VehicleProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVehicles(await fetchVehicles());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addVehicle = useCallback(async (input: NewVehicleInput) => {
    const created = await apiCreateVehicle(input);
    setError(null);
    setVehicles((previous) => [created, ...previous]);
    return created;
  }, []);

  const editVehicle = useCallback(async (id: string, patch: VehiclePatch) => {
    const updated = await apiUpdateVehicle(id, patch);
    setError(null);
    setVehicles((previous) => previous.map((vehicle) => (vehicle.id === id ? updated : vehicle)));
    return updated;
  }, []);

  const removeVehicle = useCallback(async (id: string) => {
    await apiDeleteVehicle(id);
    setError(null);
    setVehicles((previous) => previous.filter((vehicle) => vehicle.id !== id));
  }, []);

  const getVehicle = useCallback(
    (id: string) => vehicles.find((vehicle) => vehicle.id === id),
    [vehicles]
  );

  return (
    <VehicleContext.Provider
      value={{ vehicles, loading, error, refresh, addVehicle, editVehicle, removeVehicle, getVehicle }}
    >
      {children}
    </VehicleContext.Provider>
  );
}

export function useVehicles(): VehicleStore {
  const context = useContext(VehicleContext);
  if (!context) throw new Error('useVehicles must be used within a VehicleProvider');
  return context;
}

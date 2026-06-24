import { persisted, type Options, type Persisted } from 'svelte-persisted-store';
import { appName } from './Constants';

export function persistedStore<StoreType, SerializerType = StoreType>(
	key: string,
	initialValue: StoreType,
	options?: Options<StoreType, SerializerType>
): Persisted<StoreType> {
	return persisted(`${appName}:${key}`, initialValue, options);
}

import { Byte, Word, DWord, PAGE_SIZE, MemoryAccessType } from "./types";

/**
 * Memory Management Unit
 * Handles memory virtualization, paging, and caching
 */
export class MMU {
	private physicalMemory: number[];
	private memorySize: number;
	private pageDirectory: Map<number, PageTableEntry>;
	private tlbCache: Map<number, number>; // translation lookaside buffer
	private l1Cache: Map<number, CacheEntry>; // L1 Cache
	private l2Cache: Map<number, CacheEntry>; // L2 Cache
	private freeFrames: Set<number>; // track free physical frames
	private maxFrames: number;
	private protectedPages: Set<number>; // pages that cannot be evicted (code pages)

	// stats
	private pageFaults = 0;
	private cacheHits = 0;
	private cacheMisses = 0;
	private tlbHits = 0;
	private tlbMisses = 0;

	constructor(memorySize: number) {
		this.memorySize = memorySize;
		this.physicalMemory = table.create(memorySize, 0);
		this.pageDirectory = new Map();
		this.tlbCache = new Map();
		this.l1Cache = new Map();
		this.l2Cache = new Map();
		this.protectedPages = new Set(); // init a protected pages set

		// init  free frame tracking
		this.maxFrames = math.floor(memorySize / PAGE_SIZE);
		this.freeFrames = new Set();
		for (let i = 0; i < this.maxFrames; i++) {
			this.freeFrames.add(i);
		}
	}

	/**
	 * Load program into memory and protect those pages from eviction
	 */
	loadProgram(program: number[], startAddress: DWord): void {
		const startPage = math.floor(startAddress / PAGE_SIZE);
		const endAddress = startAddress + program.size() - 1;
		const endPage = math.floor(endAddress / PAGE_SIZE);

		// load the program
		for (let i = 0; i < program.size(); i++) {
			this.writeByte(startAddress + i, program[i]);
		}

		// protect all pages containing the program
		for (let page = startPage; page <= endPage; page++) {
			this.protectedPages.add(page);
		}
	}

	/**
	 * Allocate a physical frame with protection for code pages
	 */
	private allocateFrame(): number {
		// check if we have free frames
		if (this.freeFrames.size() > 0) {
			// first available frame
			let firstFrame: number | undefined;
			for (const frame of this.freeFrames) {
				firstFrame = frame;
				break;
			}
			if (firstFrame !== undefined) {
				this.freeFrames.delete(firstFrame);
				return firstFrame;
			}
		}

		// if no free frames, implement page replacement but skip protected pages
		if (this.pageDirectory.size() > 0) {
			// find oldest non-protected page to evict
			let oldestPage: number | undefined;
			for (const [pageNum] of this.pageDirectory) {
				// skip protected pages (code pages)
				if (!this.protectedPages.has(pageNum)) {
					oldestPage = pageNum;
					break;
				}
			}

			if (oldestPage !== undefined) {
				const evictedEntry = this.pageDirectory.get(oldestPage);
				if (evictedEntry) {
					// free the frame
					this.freeFrames.add(evictedEntry.frameNumber);
					// remove from page directory
					this.pageDirectory.delete(oldestPage);
					// remove from TLB if present
					this.tlbCache.delete(oldestPage);

					// allocate the freed frame
					this.freeFrames.delete(evictedEntry.frameNumber);
					return evictedEntry.frameNumber;
				}
			}
		}

		// if we still can't allocate (all pages are protected), increase memory or throw error
		throw "Out of physical memory - all pages are protected";
	}

	/**
	 * Clear all caches and reset memory, but preserve protected pages
	 */
	clearCaches(): void {
		this.tlbCache.clear();
		this.l1Cache.clear();
		this.l2Cache.clear();

		// don't clear page directory completely - preserve protected pages
		const protectedEntries = new Map<number, PageTableEntry>();
		this.pageDirectory.forEach((entry, pageNum) => {
			if (this.protectedPages.has(pageNum)) {
				protectedEntries.set(pageNum, entry);
			}
		});

		this.pageDirectory.clear();
		protectedEntries.forEach((entry, pageNum) => {
			this.pageDirectory.set(pageNum, entry);
		});

		// reset free frames, account for protected pages
		this.freeFrames.clear();
		const usedFrames = new Set<number>();
		protectedEntries.forEach((entry) => {
			usedFrames.add(entry.frameNumber);
		});

		for (let i = 0; i < this.maxFrames; i++) {
			if (!usedFrames.has(i)) {
				this.freeFrames.add(i);
			}
		}
	}

	/**
	 * Unprotect pages (for when loading new programs)
	 */
	unprotectAllPages(): void {
		this.protectedPages.clear();
	}

	/**
	 * Protect a specific page from eviction
	 */
	protectPage(virtualAddress: DWord): void {
		const pageNumber = math.floor(virtualAddress / PAGE_SIZE);
		this.protectedPages.add(pageNumber);
	}

	/**
	 * Unprotect a specific page
	 */
	unprotectPage(virtualAddress: DWord): void {
		const pageNumber = math.floor(virtualAddress / PAGE_SIZE);
		this.protectedPages.delete(pageNumber);
	}

	/**
	 * Read a byte from memory
	 */
	readByte(virtualAddress: DWord): Byte {
		const physicalAddress = this.translateAddress(virtualAddress, MemoryAccessType.READ);
		return this.readFromCache(physicalAddress, 1);
	}

	/**
	 * Read a word (16-bit) from memory
	 */
	readWord(virtualAddress: DWord): Word {
		const physicalAddress = this.translateAddress(virtualAddress, MemoryAccessType.READ);
		return this.readFromCache(physicalAddress, 2);
	}

	/**
	 * Read a double word (32-bit) from memory
	 */
	readDWord(virtualAddress: DWord): DWord {
		const physicalAddress = this.translateAddress(virtualAddress, MemoryAccessType.READ);
		return this.readFromCache(physicalAddress, 4);
	}

	/**
	 * Write a byte to memory
	 */
	writeByte(virtualAddress: DWord, value: Byte): void {
		const physicalAddress = this.translateAddress(virtualAddress, MemoryAccessType.WRITE);
		this.writeToCache(physicalAddress, value, 1);
	}

	/**
	 * Write a word (16-bit) to memory
	 */
	writeWord(virtualAddress: DWord, value: Word): void {
		const physicalAddress = this.translateAddress(virtualAddress, MemoryAccessType.WRITE);
		this.writeToCache(physicalAddress, value, 2);
	}

	/**
	 * Write a double word (32-bit) to memory
	 */
	writeDWord(virtualAddress: DWord, value: DWord): void {
		const physicalAddress = this.translateAddress(virtualAddress, MemoryAccessType.WRITE);
		this.writeToCache(physicalAddress, value, 4);
	}

	/**
	 * Translate virtual address to physical address
	 */
	private translateAddress(virtualAddress: DWord, accessType: MemoryAccessType): DWord {
		const pageNumber = math.floor(virtualAddress / PAGE_SIZE);
		const pageOffset = virtualAddress % PAGE_SIZE;

		// check TLB first
		const cachedPhysicalPage = this.tlbCache.get(pageNumber);
		if (cachedPhysicalPage !== undefined) {
			this.tlbHits++;
			return cachedPhysicalPage * PAGE_SIZE + pageOffset;
		}

		this.tlbMisses++;

		// check page directory
		let pageEntry = this.pageDirectory.get(pageNumber);
		if (!pageEntry || !pageEntry.present) {
			this.pageFaults++;
			pageEntry = this.handlePageFault(virtualAddress, accessType);
		}

		// update TLB
		const physicalPage = pageEntry.frameNumber;
		this.tlbCache.set(pageNumber, physicalPage);

		// evict old TLB entries if necessary (simple FIFO)
		if (this.tlbCache.size() > 64) {
			// get first key
			let firstKey: number | undefined;
			for (const [key] of this.tlbCache) {
				firstKey = key;
				break;
			}
			if (firstKey !== undefined) {
				this.tlbCache.delete(firstKey);
			}
		}

		return physicalPage * PAGE_SIZE + pageOffset;
	}

	/**
	 * Read from cache hierarchy
	 */
	private readFromCache(physicalAddress: DWord, size: number): number {
		const cacheLineAddress = math.floor(physicalAddress / 64) * 64; // 64-byte cache lines

		// check L1 cache
		let cacheEntry = this.l1Cache.get(cacheLineAddress);
		if (cacheEntry && cacheEntry.valid) {
			this.cacheHits++;
			cacheEntry.lastAccess = os.clock();
			return this.readFromMemory(physicalAddress, size);
		}

		// check L2 cache
		cacheEntry = this.l2Cache.get(cacheLineAddress);
		if (cacheEntry && cacheEntry.valid) {
			this.cacheHits++;
			cacheEntry.lastAccess = os.clock();
			// promote to L1
			this.l1Cache.set(cacheLineAddress, cacheEntry);
			return this.readFromMemory(physicalAddress, size);
		}

		// cache miss - read from memory
		this.cacheMisses++;
		const data = this.readFromMemory(physicalAddress, size);

		// add to L1 cache
		this.addToCache(cacheLineAddress, this.l1Cache, 256); // 256 entries in L1

		return data;
	}

	/**
	 * Write to cache hierarchy
	 */
	private writeToCache(physicalAddress: DWord, value: number, size: number): void {
		// write-through cache policy
		this.writeToMemory(physicalAddress, value, size);

		const cacheLineAddress = math.floor(physicalAddress / 64) * 64;

		// invalidate cache entries
		this.l1Cache.delete(cacheLineAddress);
		this.l2Cache.delete(cacheLineAddress);
	}

	/**
	 * Read directly from physical memory
	 */
	private readFromMemory(address: DWord, size: number): number {
		if (address + size > this.memorySize) {
			throw `Memory access violation at address 0x${string.format("%X", address)}`;
		}

		let value = 0;
		for (let i = 0; i < size; i++) {
			value |= this.physicalMemory[address + i] << (i * 8);
		}
		return value;
	}

	/**
	 * Write directly to physical memory
	 */
	private writeToMemory(address: DWord, value: number, size: number): void {
		if (address + size > this.memorySize) {
			throw `Memory access violation at address 0x${string.format("%X", address)}`;
		}

		for (let i = 0; i < size; i++) {
			this.physicalMemory[address + i] = (value >> (i * 8)) & 0xff;
		}
	}

	/**
	 * Add entry to cache with LRU eviction
	 */
	private addToCache(address: number, cache: Map<number, CacheEntry>, maxSize: number): void {
		if (cache.size() >= maxSize) {
			// find LRU entry
			let lruAddress = -1;
			let lruTime = math.huge;

			cache.forEach((entry, addr) => {
				if (entry.lastAccess < lruTime) {
					lruTime = entry.lastAccess;
					lruAddress = addr;
				}
			});

			if (lruAddress !== -1) {
				cache.delete(lruAddress);
			}
		}

		cache.set(address, {
			valid: true,
			dirty: false,
			lastAccess: os.clock(),
		});
	}

	/**
	 * Handle page fault - now returns the page entry
	 */
	private handlePageFault(virtualAddress: DWord, accessType: MemoryAccessType): PageTableEntry {
		const pageNumber = math.floor(virtualAddress / PAGE_SIZE);

		// allocate a new physical frame
		const frameNumber = this.allocateFrame();

		// create page table entry
		const pageEntry: PageTableEntry = {
			present: true,
			writable: true,
			userMode: false,
			writeThrough: false,
			cacheDisabled: false,
			accessed: false,
			dirty: false,
			frameNumber: frameNumber,
		};

		this.pageDirectory.set(pageNumber, pageEntry);
		return pageEntry;
	}

	/**
	 * Free a page (for explicit memory management)
	 */
	freePage(virtualAddress: DWord): void {
		const pageNumber = math.floor(virtualAddress / PAGE_SIZE);
		const pageEntry = this.pageDirectory.get(pageNumber);

		if (pageEntry && pageEntry.present) {
			// dont't free protected pages
			if (!this.protectedPages.has(pageNumber)) {
				// add frame back to free list
				this.freeFrames.add(pageEntry.frameNumber);
				// remove from page directory
				this.pageDirectory.delete(pageNumber);
				// remove from TLB
				this.tlbCache.delete(pageNumber);
			}
		}
	}

	/**
	 * Get memory statistics
	 */
	getStatistics() {
		return {
			pageFaults: this.pageFaults,
			cacheHits: this.cacheHits,
			cacheMisses: this.cacheMisses,
			tlbHits: this.tlbHits,
			tlbMisses: this.tlbMisses,
			cacheHitRate: this.cacheHits / (this.cacheHits + this.cacheMisses),
			tlbHitRate: this.tlbHits / (this.tlbHits + this.tlbMisses),
		};
	}

	/**
	 * Reset statistics
	 */
	resetStatistics(): void {
		this.pageFaults = 0;
		this.cacheHits = 0;
		this.cacheMisses = 0;
		this.tlbHits = 0;
		this.tlbMisses = 0;
	}
}

// internal types
interface PageTableEntry {
	present: boolean;
	writable: boolean;
	userMode: boolean;
	writeThrough: boolean;
	cacheDisabled: boolean;
	accessed: boolean;
	dirty: boolean;
	frameNumber: number;
}

interface CacheEntry {
	valid: boolean;
	dirty: boolean;
	lastAccess: number;
}

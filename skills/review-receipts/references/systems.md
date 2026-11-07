# Memory, threads, firmware, games, hot paths

- **Buffers:** does each allocation include room for the terminator or the header? Check every index and length at both ends, and integer overflow in size arithmetic.
- **Lifetimes:** is anything read or written after free, or after its owner is gone? Trace the line just after each free or move. Is anything freed twice, or returned as a pointer to a local?
- **Ownership:** who frees this, on every path including errors? Do `unsafe` blocks and raw pointers uphold what the safe code assumes?
- **Undefined behavior:** signed overflow, uninitialized reads, invalid casts, aliasing, misaligned access.
- **Data races:** is shared state protected or atomic on every access? Is lock order consistent, and can anything deadlock or hold a lock across a blocking call?
- **Interrupts and hardware:** is a variable shared with an interrupt or another core `volatile` or atomic, as the platform requires? Is a read-modify-write safe from interruption? Is the handler short and free of blocking calls?
- **Real-time limits:** is there allocation, blocking, or unbounded work on a path with a deadline? Are stack and memory budgets respected?
- **Resources:** are handles, sockets, and temp files released on every path, including errors?
- **Errors:** is every return code checked, and what state is left behind when one fails?
- **Game and simulation loops:** is motion and timing scaled by the time step, so behavior doesn't change with frame rate? Is the update deterministic where it must be? Is there per-frame allocation in a hot path?
- **Portability:** are endianness, integer widths, and alignment safe on every supported target?
- **Performance:** is a slowdown established by the code, or only suspected? Measure when the impact depends on unknown constants.

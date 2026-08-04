const normalizeNameKey = (name: string) => name.normalize("NFKC").toLowerCase();

export default normalizeNameKey;

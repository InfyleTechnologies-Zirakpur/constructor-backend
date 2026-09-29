declare module 'pg' {
  export const types: {
    setTypeParser: (oid: number, format: (val: string) => any) => void;
    [key: string]: any;
  };
  const pg: any;
  export default pg;
}

export class ScanError extends Error {
 constructor(message:string,public httpStatus=0,public diagnostic:Record<string,unknown>={}){super(message);this.name='ScanError';}
}

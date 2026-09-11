const { UnprocessableEntityException } = require('@nestjs/common');
const ex = new UnprocessableEntityException({ message: 'Validation failed', errors: { phone: ['bad'] } });
console.log(ex.getResponse());

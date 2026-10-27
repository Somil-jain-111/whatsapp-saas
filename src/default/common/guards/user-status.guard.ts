// import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
// import { ConsoleLogger } from 'src/default/logger/console/console.service';
// import { UserAuthValidator } from 'src/modules/auth/validators/user-auth.validator';

// @Injectable()
// export class UserStatusGuard implements CanActivate {
// constructor(private readonly userAuthValidator: UserAuthValidator) {}
//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest();
//     const user = request.user;

//     const now = new Date(); // server time
//     const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000; // convert to UTC
//     const istTime = new Date(utc + 5.5 * 60 * 60 * 1000); // add 5:30 hours for IST
//     const istHours = istTime.getHours();

//     // Log for debugging
//     ConsoleLogger.log(`User: ${user?.id}, IST Hour: ${istHours}`, 'UserStatusGuard');

//     if (!user || !user.id) {
//       throw new UnauthorizedException('User not authenticated');
//     }
//     await this.userAuthValidator.validateActiveUserById(user.id);

//     return true;
//   }
// }

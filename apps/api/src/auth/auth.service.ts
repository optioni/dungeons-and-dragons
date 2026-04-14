import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { User } from './entities/user.entity';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: EntityRepository<User>,
        private readonly jwtService: JwtService,
    ) {}

    async register(email: string, password: string): Promise<string> {
        const em = this.userRepository.getEntityManager();
        const existing = await em.findOne(User, { email });

        if (existing) {
            throw new Error('Email already in use');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = em.create(User, { email, passwordHash });
        em.persist(user);
        await em.flush();

        return this.jwtService.sign({ sub: user.id });
    }

    async login(email: string, password: string): Promise<string> {
        const em = this.userRepository.getEntityManager();
        const user = await em.findOne(User, { email });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return this.jwtService.sign({ sub: user.id });
    }
}

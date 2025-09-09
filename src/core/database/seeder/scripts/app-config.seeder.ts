import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { AppConfig } from '@/api/app-config/entities/app-config.entity';
import { findCreateData, findUpdateData } from '@utils/array.util';
import { Logger } from '@nestjs/common';
import { appConfigData } from '../data/app-config.data';

export class AppConfigSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    Logger.log('---------- Start AppConfigSeeder ----------');
    const existedData = await em.find(AppConfig, {});

    const createdNewData = findCreateData<AppConfig>(
      existedData,
      appConfigData,
      'key',
    );

    const updatedOldData = findUpdateData<AppConfig>(
      existedData,
      appConfigData,
      'key',
    );

    createdNewData.map((item) => {
      const newItem = em.create(AppConfig, item as any);
      em.persist(newItem);
    });

    Logger.log(`Created ${createdNewData.length} new app configs`);

    updatedOldData.map((item) => {
      const existedItem = existedData.find(
        (existed) => existed.key === item.key,
      );
      if (existedItem) {
        em.assign(existedItem, item as any);
        em.persist(existedItem);
      }
    });

    Logger.log(`Updated ${updatedOldData.length} existing app configs`);

    await em.flush();
    Logger.log('---------- End AppConfigSeeder ----------');
  }
}

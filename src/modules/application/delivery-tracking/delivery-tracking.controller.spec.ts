import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryTrackingController } from './delivery-tracking.controller';
import { DeliveryTrackingService } from './delivery-tracking.service';

describe('DeliveryTrackingController', () => {
  let controller: DeliveryTrackingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeliveryTrackingController],
      providers: [DeliveryTrackingService],
    }).compile();

    controller = module.get<DeliveryTrackingController>(DeliveryTrackingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

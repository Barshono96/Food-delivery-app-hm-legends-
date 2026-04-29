import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryTrackingService } from './delivery-tracking.service';

describe('DeliveryTrackingService', () => {
  let service: DeliveryTrackingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeliveryTrackingService],
    }).compile();

    service = module.get<DeliveryTrackingService>(DeliveryTrackingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

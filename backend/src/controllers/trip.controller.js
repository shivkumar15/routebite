import {
  cancelTrip,
  completeTrip,
  createTrip,
  getTrip,
  listTrips,
  startTrip,
} from '../services/trip.service.js';

export async function create(req, res, next) {
  try {
    const trip = await createTrip({
      partnerId: req.auth.partnerId,
      payload: req.body,
    });

    res.status(201).json({
      success: true,
      data: { trip },
    });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const trips = await listTrips(req.auth.partnerId);

    res.status(200).json({
      success: true,
      data: { trips },
    });
  } catch (error) {
    next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const trip = await getTrip({
      partnerId: req.auth.partnerId,
      tripId: req.params.tripId,
    });

    res.status(200).json({
      success: true,
      data: { trip },
    });
  } catch (error) {
    next(error);
  }
}

export async function start(req, res, next) {
  try {
    const trip = await startTrip({
      partnerId: req.auth.partnerId,
      tripId: req.params.tripId,
    });

    res.status(200).json({
      success: true,
      data: { trip },
    });
  } catch (error) {
    next(error);
  }
}

export async function cancel(req, res, next) {
  try {
    const trip = await cancelTrip({
      partnerId: req.auth.partnerId,
      tripId: req.params.tripId,
    });

    res.status(200).json({
      success: true,
      data: { trip },
    });
  } catch (error) {
    next(error);
  }
}

export async function complete(req, res, next) {
  try {
    const trip = await completeTrip({
      partnerId: req.auth.partnerId,
      tripId: req.params.tripId,
    });

    res.status(200).json({
      success: true,
      data: { trip },
    });
  } catch (error) {
    next(error);
  }
}

// import pgformat from 'pg-format';
import { RecordValues } from 'fulcrum';

export default class MSSQLRecordValues extends RecordValues {
  static setupSearch(values, feature) {
    const searchableValue = feature.searchableValue;

    values.record_index_text = searchableValue;
    values.record_index = searchableValue; //{raw: `to_tsvector(${ pgformat('%L', searchableValue) })`};

    return values;
  }

  static setupPoint(values, latitude, longitude) {
    return {raw: 'NULL'};
    // const wkt = pgformat('POINT(%s %s)', longitude, latitude);

    // return {raw: `ST_Force2D(ST_SetSRID(ST_GeomFromText('${ wkt }'), 4326))`};
  }
}


import { format } from 'util';
import { RecordValues } from 'fulcrum';

export default class MSSQLRecordValues extends RecordValues {
  static setupSearch(values, feature) {
    const searchableValue = feature.searchableValue;

    values.record_index_text = searchableValue;
    values.record_index = searchableValue; //{raw: `to_tsvector(${ pgformat('%L', searchableValue) })`};

    return values;
  }

  static setupPoint(values, latitude, longitude) {
    const wkt = format('POINT(%s %s)', longitude, latitude);
    return {raw: `geography::STGeomFromText('${ wkt }', 4326)`};
  }
}

